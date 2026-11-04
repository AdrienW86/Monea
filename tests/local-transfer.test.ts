import { it, expect, vi } from "vitest";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { LocalRepository } from "@/lib/data/local";
import { verifyLocalImport } from "../scripts/verify-local-import.mjs";
import { PGlite } from "@electric-sql/pglite";
import {
  prepareTransfer,
  validateExport,
  sha256,
} from "../scripts/local-transfer.mjs";

it("sauvegarde le WAL, restaure, importe sans perte et rejoue sans doublon", async () => {
  vi.stubEnv("NODE_ENV", "test");
  const root = `.local/transfer-test-${randomUUID()}`;
  mkdirSync(root, { recursive: true });
  const source = `${root}/source.sqlite`,
    target = `${root}/backup`;
  const local = new LocalRepository(source);
  const pg = new PGlite();
  try {
    await local.mutate(
      {
        action: "hours_save",
        data: {
          hours: Array.from({ length: 7 }, (_, weekday) => ({
            weekday,
            opens: "08:00",
            closes: "20:00",
          })),
        },
      },
      "local-admin",
    );
    const services = (await local.services()).filter(
      (s) => s.qualification_requirement === "none",
    );
    const t = new Date();
    t.setUTCDate(t.getUTCDate() + 4);
    t.setUTCHours(10, 0, 0, 0);
    const b = await local.createBooking({
      service_ids: [services[0].id, services[1].id],
      start_at: t.toISOString(),
      request_id: randomUUID(),
      client: {
        first_name: "Archive",
        last_name: "Test",
        email: "archive@example.invalid",
        phone: "+33612345678",
      },
    });
    await local.simulatePayment(b.public_token, "success");
    const fingerprint = sha256(readFileSync(`${source}-wal`));
    const manifest = prepareTransfer(source, target);
    expect(manifest.restoration_verified).toBe(true);
    expect(manifest.backup_sha256).toBe(manifest.restoration_sha256);
    expect(sha256(readFileSync(`${source}-wal`))).toBe(fingerprint);
    const restored = new DatabaseSync(`${target}/restoration-test.sqlite`, {
      readOnly: true,
    });
    expect(restored.prepare("select count(*) n from bookings").get()!.n).toBe(
      1,
    );
    restored.close();
    const envelope = JSON.parse(readFileSync(`${target}/export.json`, "utf8"));
    validateExport(envelope);
    const actor = randomUUID();
    await pg.exec(
      "create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role bypassrls;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;",
    );
    for (const f of readdirSync("supabase/migrations")
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await pg.exec(readFileSync(`supabase/migrations/${f}`, "utf8"));
    await pg.query("insert into auth.users values($1)", [actor]);
    await pg.query("insert into public.admin_users(user_id) values($1)", [
      actor,
    ]);
    await pg.query(
      "insert into public.local_import_archives(source,schema_version,sha256,payload) values('local',2,$1,$2)",
      [manifest.sha256, JSON.stringify(envelope)],
    );
    const imported = await pg.query<{ value: { replayed: boolean } }>(
      "select public.management_import_archive($1,$2) value",
      [actor, manifest.sha256],
    );
    expect(imported.rows[0].value.replayed).toBe(false);
    expect(await verifyLocalImport(pg, envelope)).toMatchObject({
      verified: true,
      counts: {
        categories: 7,
        services: 16,
        clients: 1,
        lines: 2,
        mock_payments: 1,
      },
    });
    expect(
      (
        await pg.query<{ value: { replayed: boolean } }>(
          "select public.management_import_archive($1,$2) value",
          [actor, manifest.sha256],
        )
      ).rows[0].value.replayed,
    ).toBe(true);
    const payments = await pg.query<{
      provider: string;
      status: string;
      stripe_payment_intent: string | null;
    }>("select provider,status,stripe_payment_intent from public.payments");
    expect(payments.rows).toEqual([
      { provider: "mock", status: "mock_paid", stripe_payment_intent: null },
    ]);
    // An imported simulation must never become a real paid Stripe record.
    await expect(
      pg.query(
        "update public.payments set status='paid' where provider='mock'",
      ),
    ).rejects.toThrow();
    const paymentIdentity = await pg.query<{ id: string; request_id: string }>(
      "select id,request_id from public.bookings limit 1",
    );
    await expect(
      pg.query(
        "select public.process_payment_event(p_event=>$1,p_type=>$2,p_session=>$3,p_intent=>$4,p_amount=>$5,p_currency=>$6,p_state=>$7,p_booking=>$8,p_request=>$9)",
        [
          "evt_mock_separation",
          "checkout.session.completed",
          "cs_test_fake",
          "pi_test_fake",
          b.price_cents,
          "eur",
          "paid",
          paymentIdentity.rows[0].id,
          paymentIdentity.rows[0].request_id,
        ],
      ),
    ).rejects.toThrow();
    expect(
      (await pg.query("select status,provider from public.payments")).rows,
    ).toEqual([{ status: "mock_paid", provider: "mock" }]);
    expect(
      (
        await pg.query(
          "select id from public.webhook_events where id='evt_mock_separation'",
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (await pg.query("select * from public.booking_lines")).rows,
    ).toHaveLength(2);
    expect((await pg.query("select * from public.clients")).rows).toHaveLength(
      1,
    );
    expect(
      (await pg.query("select * from public.notification_outbox")).rows,
    ).toHaveLength(0);
    expect(
      (
        await pg.query<{
          value: {
            settings: { bookingEnabled: boolean };
            bookings: Array<{ price_cents: number; lines: unknown[] }>;
          };
        }>("select public.management_snapshot($1) value", [actor])
      ).rows[0].value,
    ).toMatchObject({
      settings: { bookingEnabled: false },
      bookings: [
        {
          price_cents: b.price_cents,
          lines: envelope.data.bookings[0].lines.map((l: { id: string }) =>
            expect.objectContaining({ id: l.id }),
          ),
        },
      ],
    });
    const broken = structuredClone(envelope);
    broken.data.bookings[0].client_id = randomUUID();
    expect(() => validateExport(broken)).toThrow("Référence");
    const collision = structuredClone(envelope);
    collision.data.clients[0].id = randomUUID();
    await pg.query(
      "insert into public.local_import_archives(source,schema_version,sha256,payload) values('local',2,$1,$2)",
      ["another-archive", JSON.stringify(collision)],
    );
    await expect(
      pg.query("select public.management_import_archive($1,$2)", [
        actor,
        "another-archive",
      ]),
    ).rejects.toThrow();
    expect((await pg.query("select * from public.bookings")).rows).toHaveLength(
      1,
    );
    expect(() => prepareTransfer(source, target)).toThrow("écrasé");
  } finally {
    local.close();
    await pg.close();
    vi.unstubAllEnvs();
  }
});
