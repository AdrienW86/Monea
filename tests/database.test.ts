import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { catalogue } from "@/lib/catalogue";
let pg: PGlite;
const admin = "11111111-1111-4111-8111-111111111111";
const service = catalogue[0].id;
// Identités et horaires ci-dessous sont des fixtures éphémères de test, jamais des seeds publics.
const person = {
  first_name: "Test",
  last_name: "Éphémère",
  email: "test@example.invalid",
  phone: "+33600000000",
};
let serial = 0;
const request = () =>
  `22222222-2222-4222-8222-${String(++serial).padStart(12, "0")}`;
async function hold(start: string, s = service, actor: string | null = null) {
  const r = await pg.query<{
    b: { id: string; token: string; price_cents: number };
  }>("select public.create_booking($1,$2,$3,$4,$5,$6) b", [
    s,
    start,
    JSON.stringify(person),
    request(),
    actor,
    actor ? "unpaid" : null,
  ]);
  return r.rows[0].b;
}
async function event(
  id: string,
  session: string,
  state = "paid",
  amount = 2000,
) {
  return pg.query(
    "select public.process_payment_event($1,$2,$3,$4,$5,$6,$7) result",
    [
      id,
      "checkout.session.completed",
      session,
      `pi_${session}`,
      amount,
      "eur",
      state,
    ],
  );
}
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(
    `create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role bypassrls;create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
  );
  for (const f of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await pg.exec(readFileSync(`supabase/migrations/${f}`, "utf8"));
  await pg.exec(readFileSync("supabase/seed.sql", "utf8"));
  await pg.exec(
    `insert into auth.users values('${admin}');insert into public.admin_users(user_id) values('${admin}');update public.site_settings set value='{"bookingEnabled":true,"legalReady":true,"privacyReady":true,"pricesValidated":true,"noticeHours":1,"horizonDays":365}';insert into public.business_hours(weekday,opens,closes) select i,'08:00','20:00' from generate_series(0,6)i;`,
  );
});
afterAll(async () => {
  await pg?.close();
});
const date = (offset: number, hour = 10) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};
describe("migration Postgres réelle embarquée", () => {
  it("autorise un équipement tarifé après confirmation et conserve le verrou sans confirmation", async () => {
    const s = catalogue.find(
      (v) => v.qualification_requirement === "equipment",
    )!;
    await pg.exec("begin");
    try {
      await pg.query(
        "update public.services set qualification_verified_at=now(), price_cents=3500, bookable=true, operational_status='active' where id=$1",
        [s.id],
      );
      expect(
        (
          await pg.query<{ ok: boolean }>(
            "select public.service_eligible($1) ok",
            [s.id],
          )
        ).rows[0].ok,
      ).toBe(true);
      await expect(
        pg.query(
          "update public.services set qualification_verified_at=null where id=$1",
          [s.id],
        ),
      ).rejects.toThrow();
    } finally {
      await pg.exec("rollback");
    }
  });
  it("prépare catégories, produits et lignes figées avec RLS sans droit de mutation public", async () => {
    const b = await hold(date(28));
    const result = await pg.query<{
      price_cents: number;
      service_name: string;
    }>(
      "select price_cents,service_name from public.booking_lines where booking_id=$1",
      [b.id],
    );
    expect(result.rows[0].price_cents).toBe(2000);
    await pg.exec("set role anon");
    for (const table of [
      "categories",
      "products",
      "booking_lines",
      "local_import_archives",
    ])
      await expect(pg.query(`select * from public.${table}`)).rejects.toThrow();
    await pg.exec("reset role;set role authenticated");
    for (const table of [
      "categories",
      "products",
      "booking_lines",
      "local_import_archives",
    ])
      expect(
        (await pg.query(`select * from public.${table}`)).rows,
      ).toHaveLength(0);
    await pg.exec("reset role");
  });
  it("récupère une session non attachée grâce aux seules métadonnées signées et à la clé persistée", async () => {
    const b = await hold(date(17));
    const { rows } = await pg.query<{ request_id: string }>(
      "select request_id from public.bookings where id=$1",
      [b.id],
    );
    await pg.query(
      "select public.process_payment_event('evt_recover','checkout.session.completed','cs_recover','pi_recover',2000,'eur','paid',0,$1,$2)",
      [b.id, rows[0].request_id],
    );
    const status = await pg.query(
      "select status,stripe_session_id from public.payments where booking_id=$1",
      [b.id],
    );
    expect(status.rows[0]).toEqual({
      status: "paid",
      stripe_session_id: "cs_recover",
    });
  });
  it("les horaires manquants, le préavis, les dates passées et une fausse identité admin sont refusés", async () => {
    await expect(
      hold(new Date(Date.now() - 3600000).toISOString()),
    ).rejects.toThrow();
    await expect(
      hold(date(14), service, "33333333-3333-4333-8333-333333333333"),
    ).rejects.toThrow();
    await pg.query("select public.admin_mutate($1,$2,$3)", [
      admin,
      "special_hours",
      JSON.stringify({
        date: date(15).slice(0, 10),
        intervals: [],
        reason: "fixture",
      }),
    ]);
    await expect(hold(date(15))).rejects.toThrow();
  });
  it("les allocations UTC traversent les changements d’heure en restant contiguës", async () => {
    await pg.exec(
      "insert into public.time_allocations(start_at,end_at,kind) values('2028-03-26 00:00Z','2028-03-26 01:00Z','block'),('2028-03-26 01:00Z','2028-03-26 02:00Z','block'),('2028-10-29 00:00Z','2028-10-29 01:00Z','block'),('2028-10-29 01:00Z','2028-10-29 02:00Z','block')",
    );
    const result = await pg.query(
      "select (timestamptz '2028-03-26 01:00Z' at time zone 'Europe/Paris')::text local",
    );
    expect(result.rows[0]).toEqual({ local: "2028-03-26 03:00:00" });
  });
  it("la politique configurable conserve la marge de sécurité entre hold et Checkout", async () => {
    await pg.exec(
      'update public.site_settings set value=value||\'{"checkoutMinutes":40,"holdMinutes":45}\'',
    );
    const b = await hold(date(16));
    const { rows } = await pg.query<{ minutes: number }>(
      "select round(extract(epoch from (expires_at-created_at))/60)::int minutes from public.time_allocations where id=(select allocation_id from public.bookings where id=$1)",
      [b.id],
    );
    expect(rows[0].minutes).toBe(45);
    await pg.exec(
      'update public.site_settings set value=value||\'{"checkoutMinutes":30,"holdMinutes":35}\'',
    );
  });
  it("seed réexécutable et catalogue complet", async () => {
    await pg.exec(readFileSync("supabase/seed.sql", "utf8"));
    const { rows } = await pg.query(
      "select count(*)::int n from public.services",
    );
    expect(rows[0]).toEqual({ n: 16 });
  });
  it("deux demandes concurrentes au même instant : une seule allocation", async () => {
    const results = await Promise.allSettled([hold(date(2)), hold(date(2))]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
  it("accepte les créneaux adjacents", async () => {
    await hold(date(3, 10));
    await expect(hold(date(3, 11))).resolves.toHaveProperty("id");
  });
  it("conflit manuel / public et blocage / public", async () => {
    await hold(date(4), service, admin);
    await expect(hold(date(4))).rejects.toThrow();
    await pg.query("select public.admin_mutate($1,$2,$3)", [
      admin,
      "block",
      JSON.stringify({
        start_at: date(5, 10),
        end_at: date(5, 12),
        reason: "fixture",
      }),
    ]);
    await expect(hold(date(5, 11))).rejects.toThrow();
  });
  it.each([1, 7, 31])(
    "bloque une période de %i jours sans écraser les rendez-vous",
    async (length) => {
      const offset = 50 + length;
      await pg.query("select public.admin_mutate($1,$2,$3)", [
        admin,
        "block",
        JSON.stringify({
          start_at: date(offset, 0),
          end_at: date(offset + length, 0),
          reason: "fixture",
        }),
      ]);
      await expect(hold(date(offset, 11))).rejects.toThrow();
    },
  );
  it("ne peut pas écraser un rendez-vous payé par un blocage", async () => {
    const b = await hold(date(6));
    await pg.query("select public.attach_checkout($1,$2)", [b.id, "cs_block"]);
    await event("evt_block", "cs_block");
    await expect(
      pg.query("select public.admin_mutate($1,$2,$3)", [
        admin,
        "block",
        JSON.stringify({ start_at: date(6, 0), end_at: date(7, 0) }),
      ]),
    ).rejects.toThrow();
  });
  it("refuse les services B et les procédés même si les toggles sont falsifiés", async () => {
    const s = catalogue[5].id;
    await pg.query(
      "update public.services set bookable=true,operational_status='active' where id=$1",
      [s],
    );
    await expect(hold(date(8), s)).rejects.toThrow();
    await pg.query("select public.admin_mutate($1,$2,$3)", [
      admin,
      "verify_qualification",
      JSON.stringify({
        id: s,
        attestation: "QUALIFICATION VÉRIFIÉE",
        evidence: "preuve fixture de test",
      }),
    ]);
    await expect(hold(date(8), s)).resolves.toHaveProperty("id");
    await expect(
      pg.query(
        "update public.services set bookable=true,operational_status='active',price_cents=2000 where slug='uv'",
      ),
    ).rejects.toThrow();
  });
  it("snapshots de prix et durée stables, confirmation idempotente et outbox unique", async () => {
    const b = await hold(date(9));
    await pg.query("select public.attach_checkout($1,$2)", [b.id, "cs_once"]);
    await event("evt_once", "cs_once");
    await event("evt_once", "cs_once");
    await event("evt_once_again", "cs_once");
    await pg.query(
      "update public.services set price_cents=2500,duration_minutes=90 where id=$1",
      [service],
    );
    const { rows } = await pg.query(
      "select price_cents,duration_minutes,status,(select count(*)::int from public.notification_outbox where booking_id=$1) notifications from public.bookings where id=$1",
      [b.id],
    );
    expect(rows[0]).toEqual({
      price_cents: 2000,
      duration_minutes: 60,
      status: "confirmed",
      notifications: 2,
    });
    await pg.query(
      "update public.services set price_cents=2000,duration_minutes=60 where id=$1",
      [service],
    );
  });
  it("expiration et paiement tardif avec réattribution : réconciliation sans double booking", async () => {
    const old = await hold(date(10));
    await pg.query("select public.attach_checkout($1,$2)", [old.id, "cs_late"]);
    await pg.query(
      "update public.time_allocations set expires_at=now()-interval '1 minute' where id=(select allocation_id from public.bookings where id=$1)",
      [old.id],
    );
    await pg.exec("select public.expire_holds()");
    await hold(date(10));
    await event("evt_late", "cs_late");
    const { rows } = await pg.query(
      "select status from public.bookings where id=$1",
      [old.id],
    );
    expect(rows[0]).toEqual({ status: "reconciliation" });
  });
  it("refuse un montant falsifié et permet le retry du même événement après rollback", async () => {
    const b = await hold(date(11));
    await pg.query("select public.attach_checkout($1,$2)", [b.id, "cs_amount"]);
    await expect(event("evt_amount", "cs_amount", "paid", 1)).rejects.toThrow();
    await expect(event("evt_amount", "cs_amount")).resolves.toBeDefined();
  });
  it("annuler ne rembourse pas implicitement, remboursement partiel monotone", async () => {
    const b = await hold(date(12));
    await pg.query("select public.attach_checkout($1,$2)", [b.id, "cs_cancel"]);
    await event("evt_cancel", "cs_cancel");
    await pg.query("select public.admin_mutate($1,$2,$3)", [
      admin,
      "cancel",
      JSON.stringify({ id: b.id }),
    ]);
    const { rows } = await pg.query(
      "select status from public.payments where booking_id=$1",
      [b.id],
    );
    expect(rows[0]).toEqual({ status: "paid" });
    await pg.query(
      "select public.process_payment_event('evt_refund','charge.refunded',null,'pi_cs_cancel',2000,'eur','refunded',1000)",
    );
    const p = await pg.query(
      "select status,refunded_cents from public.payments where booking_id=$1",
      [b.id],
    );
    expect(p.rows[0]).toEqual({
      status: "partial_refund",
      refunded_cents: 1000,
    });
  });
  it("RLS : public et non-admin ne lisent aucune PII ni RPC métier", async () => {
    await pg.exec("set role anon");
    await expect(pg.query("select * from public.clients")).rejects.toThrow();
    await expect(pg.query("select public.expire_holds()")).rejects.toThrow();
    await pg.exec("reset role;set role authenticated");
    const { rows } = await pg.query("select * from public.clients");
    expect(rows).toHaveLength(0);
    await expect(
      pg.query("insert into public.site_settings values(2,'{}')"),
    ).rejects.toThrow();
    await expect(pg.query("select public.expire_holds()")).rejects.toThrow();
    await pg.exec("reset role");
  });
  it("RLS admin autorisé en lecture et aucune inscription ou auto-promotion en DB", async () => {
    await pg.exec(
      `set role authenticated;set request.jwt.claim.sub='${admin}'`,
    );
    const { rows } = await pg.query("select * from public.clients");
    expect(rows.length).toBeGreaterThan(0);
    await expect(
      pg.query(
        `insert into public.admin_users(user_id) values(gen_random_uuid())`,
      ),
    ).rejects.toThrow();
    await pg.exec("reset role;reset request.jwt.claim.sub");
  });
  it("les disponibilités ne contiennent aucune PII ni raison de blocage", async () => {
    const { rows } = await pg.query<{
      start_at: string;
      end_at: string;
      available: boolean;
    }>("select * from public.availability($1,$2)", [
      service,
      date(3).slice(0, 10),
    ]);
    expect(rows.length).toBeGreaterThan(0);
    expect(Object.keys(rows[0]).sort()).toEqual([
      "available",
      "end_at",
      "start_at",
    ]);
    expect(rows.some((r) => r.available === false)).toBe(true);
  });
  it("un retour succès sans webhook reste en attente", async () => {
    const b = await hold(date(13));
    const { rows } = await pg.query(
      "select status from public.bookings where public_token=$1",
      [b.token],
    );
    expect(rows[0]).toEqual({ status: "pending" });
  });
  it("contact conservé avec notification non envoyée et claim atomique", async () => {
    await pg.query("select public.store_contact($1)", [
      JSON.stringify({
        ...person,
        subject: "Test contact",
        message: "Message éphémère",
      }),
    ]);
    const { rows } = await pg.query<{ id: string }>(
      "select * from public.claim_notifications()",
    );
    expect(rows.length).toBeGreaterThan(0);
    const again = await pg.query<{ id: string }>(
      "select * from public.claim_notifications()",
    );
    expect(
      again.rows.every((r) => !rows.some((previous) => previous.id === r.id)),
    ).toBe(true);
    const exhausted = await pg.query(
      "select * from public.claim_notifications()",
    );
    expect(exhausted.rows).toHaveLength(0);
  });
  it("quota persistant et atomique", async () => {
    const out = await Promise.all(
      [1, 2, 3].map(() =>
        pg.query<{ ok: boolean }>("select public.take_rate_limit($1,2) ok", [
          "test",
        ]),
      ),
    );
    expect(out.map((r) => r.rows[0].ok)).toEqual([true, true, false]);
  });
});
