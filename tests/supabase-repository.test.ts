import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { SupabaseRepository } from "@/lib/data/supabase";
import type { Snapshot } from "@/lib/data/types";
const actor = "11111111-1111-4111-8111-111111111111";
let pg: PGlite;
let repo: SupabaseRepository;
let initial: Snapshot;
const person = {
  first_name: "Test",
  last_name: "Confidentiel",
  email: "test@example.invalid",
  phone: "+33612345678",
};
const start = (days: number) => {
  const t = new Date();
  t.setUTCDate(t.getUTCDate() + days);
  t.setUTCHours(10, 0, 0, 0);
  return t.toISOString();
};
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(
    "create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role bypassrls; create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;",
  );
  for (const f of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await pg.exec(readFileSync(`supabase/migrations/${f}`, "utf8"));
  await pg.exec(readFileSync("supabase/seed.sql", "utf8"));
  await pg.exec(
    `insert into auth.users values('${actor}'); insert into public.admin_users(user_id) values('${actor}'); update public.site_settings set value='{"bookingEnabled":true,"legalReady":true,"privacyReady":true,"pricesValidated":true,"noticeHours":1,"horizonDays":365}'; insert into public.business_hours(weekday,opens,closes) select i,'08:00','20:00' from generate_series(0,6)i;`,
  );
  repo = new SupabaseRepository(async (name, args = {}) => {
    try {
      const entries = Object.entries(args);
      const sql =
        name === "availability"
          ? `select * from public.${name}(${entries.map(([key], i) => `${key}=>$${i + 1}`).join(",")})`
          : `select public.${name}(${entries.map(([key], i) => `${key}=>$${i + 1}`).join(",")}) value`;
      const r = await pg.query<{ value: unknown }>(
        sql,
        entries.map(([, v]) =>
          v && typeof v === "object" ? JSON.stringify(v) : v,
        ),
      );
      return {
        data: name === "availability" ? r.rows : r.rows[0]?.value,
        error: null,
      };
    } catch (e) {
      if (
        (e as { code: string }).code !== "P0001" &&
        (e as { code: string }).code !== "23503" &&
        (e as { code: string }).code !== "23P01"
      )
        console.error("RPC TEST", name, e);
      return {
        data: null,
        error: e as { code: string; message: string; details: string },
      };
    }
  });
  initial = await repo.snapshot({}, actor);
});
afterAll(async () => {
  await pg?.close();
});
const mutate = (action: string, data: unknown) =>
  repo.mutate({ action, data }, actor);
const booking = (days: number, ids = [initial.services[0].id]) =>
  repo.createBooking(
    {
      service_ids: ids,
      start_at: start(days),
      request_id: randomUUID(),
      client: person,
      offline_status: "unpaid",
    },
    actor,
  );
describe("adaptateur Supabase sur PostgreSQL local", () => {
  it("retourne les contrats normalisés et contrôle l’acteur", async () => {
    expect(initial.services).toHaveLength(16);
    expect(initial.categories).toHaveLength(7);
    expect(initial.settings.name).toBe("MONÉA");
    await expect(repo.snapshot({}, randomUUID())).rejects.toThrow(
      "UNAUTHORIZED",
    );
    expect(await repo.settings()).toMatchObject({
      name: "MONÉA",
      slotStepMinutes: 30,
    });
    expect(await repo.services()).toHaveLength(16);
  });
  it("gère catégories, prestations, prix, durées, produits et archive", async () => {
    const category = (await mutate("category_save", {
      name: "Catégorie test",
      description: "",
      image: "",
      sort_order: 10,
      active: true,
    })) as { id: string };
    const data = {
      name: "Prestation test",
      category_id: category.id,
      description: "Soin",
      price_cents: 3100,
      duration_minutes: 45,
      image: "/images/beauty/soin-visage.webp",
      sort_order: 1,
      visibility: true,
      bookable: true,
      operational_status: "active",
      qualification_requirement: "none",
    };
    const service = (await mutate("service_save", data)) as { id: string };
    await mutate("service_save", {
      ...data,
      id: service.id,
      price_cents: 3200,
      duration_minutes: 50,
    });
    const product = (await mutate("product_save", {
      name: "Produit",
      category_id: category.id,
      description: "",
      price_cents: 800,
      image: "",
      status: "active",
      stock: 3,
    })) as { id: string };
    const s = await repo.snapshot({}, actor);
    expect(s.services.find((v) => v.id === service.id)).toMatchObject({
      price_cents: 3200,
      duration_minutes: 50,
    });
    expect(s.products.find((v) => v.id === product.id)?.stock).toBe(3);
    await expect(
      mutate("category_delete", { id: category.id, confirmed: true }),
    ).rejects.toThrow();
    await mutate("service_save", { ...data, id: service.id, image: "none" });
    expect(
      (await repo.services()).find((s) => s.id === service.id)?.image,
    ).toBe("none");
    await mutate("service_save", { ...data, id: service.id, image: "" });
    expect(
      (await repo.services()).find((s) => s.id === service.id)?.image,
    ).toBeNull();
    await mutate("service_archive", { id: service.id, confirmed: true });
    await mutate("product_delete", { id: product.id, confirmed: true });
    await mutate("service_delete", { id: service.id, confirmed: true });
    expect((await repo.services()).some((s) => s.id === service.id)).toBe(
      false,
    );
    await mutate("category_delete", { id: category.id, confirmed: true });
  });
  it("crée plusieurs lignes, fige les montants et déplace atomiquement", async () => {
    const b = await booking(4, [
      initial.services[0].id,
      initial.services[1].id,
    ]);
    const before = (await repo.snapshot({}, actor)).bookings.find(
      (v) => v.id === b.id,
    )!;
    expect(before.lines).toHaveLength(2);
    expect(before.duration_minutes).toBe(120);
    const s = initial.services[0];
    await mutate("service_save", {
      ...s,
      price_cents: 9900,
      duration_minutes: 90,
      image: s.image || "",
    });
    await mutate("booking_save", {
      id: b.id,
      confirmed: true,
      service_ids: before.lines.map((l) => l.service_id),
      start_at: start(5),
      request_id: randomUUID(),
      client_id: before.client_id,
      offline_status: "unpaid",
      status: "confirmed",
    });
    const after = (await repo.snapshot({}, actor)).bookings.find(
      (v) => v.id === b.id,
    )!;
    const filtered = await repo.snapshot(
      {
        section: "rendez-vous",
        status: "confirmed",
        date: start(5).slice(0, 10),
        search: person.email,
      },
      actor,
    );
    expect(filtered.bookings.map((v) => v.id)).toEqual([b.id]);
    expect(filtered.pagination?.total).toBe(1);
    expect(
      (
        await repo.snapshot(
          {
            section: "rendez-vous",
            status: "cancelled",
            date: start(5).slice(0, 10),
          },
          actor,
        )
      ).bookings,
    ).toEqual([]);
    expect(after.price_cents).toBe(before.price_cents);
    expect(after.duration_minutes).toBe(120);
    const other = await booking(6);
    await expect(
      mutate("booking_save", {
        id: b.id,
        confirmed: true,
        service_ids: before.lines.map((l) => l.service_id),
        start_at: start(6),
        request_id: randomUUID(),
        client_id: before.client_id,
        status: "confirmed",
      }),
    ).rejects.toThrow("Créneau");
    expect(
      Date.parse((await repo.publicBooking(before.public_token))!.start_at),
    ).toBe(Date.parse(start(5)));
    await mutate("booking_cancel", {
      id: other.id,
      reason: "Test",
      confirmed: true,
    });
    await mutate("service_save", { ...s, image: s.image || "" });
  });
  it("reprend la même demande, refuse un contenu différent et garde une projection publique minimale", async () => {
    const input = {
      service_ids: [initial.services[0].id],
      start_at: start(7),
      request_id: randomUUID(),
      client: person,
    };
    const one = await repo.createBooking(input);
    const two = await repo.createBooking(input);
    expect(two.id).toBe(one.id);
    expect(two.checkout_expires_at).toBe(one.checkout_expires_at);
    await expect(
      repo.createBooking({ ...input, start_at: start(8) }),
    ).rejects.toThrow("autre contenu");
    await pg.query("select public.attach_checkout($1,$2)", [
      one.id,
      "cs_resume",
    ]);
    await pg.query("select public.attach_checkout($1,$2)", [
      one.id,
      "cs_resume",
    ]);
    const projection = await repo.publicBooking(one.public_token);
    expect(projection).not.toHaveProperty("client");
    expect(projection).not.toHaveProperty("stripe_session_id");
    await mutate("booking_cancel", {
      id: one.id,
      reason: "Test",
      confirmed: true,
    });
  });
  it("respecte catégories désactivées, qualifications et pas configurable", async () => {
    const s = initial.services[0],
      cat = initial.categories.find((c) => c.id === s.category_id)!;
    await mutate("category_save", { ...cat, active: false });
    expect(await repo.availability(s.id, start(10).slice(0, 10))).toEqual([]);
    await expect(booking(10)).rejects.toThrow("autorisée");
    await mutate("category_save", cat);
    for (const regulated of initial.services.filter(
      (s) => s.qualification_requirement !== "none",
    ))
      await expect(booking(12, [regulated.id])).rejects.toThrow("autorisée");
    await mutate("settings_save", { ...initial.settings, slotStepMinutes: 20 });
    const slots = await repo.availability(s.id, start(10).slice(0, 10));
    expect(slots.length).toBeGreaterThan(0);
    expect(
      slots.every((s) => new Date(s.start_at).getUTCMinutes() % 20 === 0),
    ).toBe(true);
    await mutate("settings_save", initial.settings);
  });
  it("gère clientes et données filtrées/paginées sans notes dans une recherche", async () => {
    const client = (await mutate("client_save", {
      ...person,
      email: "other@example.invalid",
      notes: "Note privée",
    })) as { id: string };
    await mutate("client_save", {
      ...person,
      id: client.id,
      last_name: "Modifiée",
      notes: "Note privée",
    });
    for (let i = 0; i < 52; i++)
      await mutate("client_save", {
        ...person,
        last_name: `Pagination ${i}`,
        email: `client${i}@example.invalid`,
        notes: "Note privée",
      });
    const a = await repo.snapshot(
      { section: "lookup", search: "Pagination" },
      actor,
    );
    expect(a.clients).toHaveLength(50);
    expect(a.pagination?.total).toBe(52);
    expect(a.clients.every((c) => !c.notes)).toBe(true);
    expect(
      (
        await repo.snapshot(
          { section: "lookup", search: "Pagination", page: 1 },
          actor,
        )
      ).clients,
    ).toHaveLength(2);
    const catalogue = await repo.snapshot({ section: "catalogue" }, actor);
    expect(catalogue.clients).toEqual([]);
    expect(catalogue.bookings).toEqual([]);
    expect(catalogue.messages).toEqual([]);
    await mutate("client_delete", { id: client.id, confirmed: true });
    const b = await booking(15);
    const saved = (await repo.snapshot({}, actor)).bookings.find(
      (x) => x.id === b.id,
    )!;
    await expect(
      mutate("client_delete", { id: saved.client_id, confirmed: true }),
    ).rejects.toThrow("historique");
  });
  it("préserve les blocages récurrents Paris et rollback les conflits", async () => {
    const first = "2027-03-21T09:00:00+01:00";
    await mutate("block_save", {
      start_at: first,
      end_at: "2027-03-21T10:00:00+01:00",
      reason: "Récurrence",
      repeat: "weekly",
      repeat_until: "2027-03-28",
    });
    const blocks = (await repo.snapshot({}, actor)).allocations
      .filter((a) => a.reason === "Récurrence")
      .sort((a, b) => a.start_at.localeCompare(b.start_at));
    expect(blocks).toHaveLength(2);
    expect(
      (Date.parse(blocks[1].start_at) - Date.parse(blocks[0].start_at)) /
        3600000,
    ).toBe(167);
    await mutate("block_delete", {
      id: blocks[0].id,
      series: true,
      confirmed: true,
    });
    const b = await booking(18);
    await expect(
      mutate("block_save", {
        start_at: start(18),
        end_at: new Date(Date.parse(start(18)) + 3600000).toISOString(),
        reason: "Conflit",
        repeat: "none",
      }),
    ).rejects.toThrow("Créneau");
    await mutate("booking_cancel", {
      id: b.id,
      reason: "Test",
      confirmed: true,
    });
    await mutate("booking_delete", { id: b.id, confirmed: true });
  });
  it("horaires, exceptions, génération et notifications internes ne déclenchent aucun transport", async () => {
    const date = start(22).slice(0, 10);
    await mutate("special_save", { date, intervals: [], reason: "Fermé" });
    expect(await repo.availability(initial.services[0].id, date)).toEqual([]);
    await mutate("special_delete", { date });
    const generated = (await mutate("generate", {
      start_date: date,
      end_date: date,
      service_id: initial.services[0].id,
    })) as { total: number };
    expect(generated.total).toBeGreaterThan(0);
    const s = await repo.snapshot({}, actor);
    expect(s.notifications.length).toBeGreaterThan(0);
    await mutate("notification_read", { id: s.notifications[0].id });
    await repo.storeContact({
      first_name: "Test",
      email: "contact@example.invalid",
      subject: "Question",
      message: "Une question",
    });
    const contacts = await repo.snapshot({ section: "messages" }, actor);
    await mutate("contact_processed", { id: contacts.messages[0].id });
    await mutate("contact_delete", {
      id: contacts.messages[0].id,
      confirmed: true,
    });
    await expect(
      mutate("hours_save", {
        hours: [
          { weekday: 1, opens: "08:00", closes: "12:00" },
          { weekday: 1, opens: "11:00", closes: "14:00" },
        ],
      }),
    ).rejects.toThrow("chevauchent");
    await mutate("hours_save", {
      hours: initial.hours.map(({ weekday, opens, closes }) => ({
        weekday,
        opens,
        closes,
      })),
    });
    await expect(mutate("demo_load", { confirmed: true })).rejects.toThrow(
      "réservé",
    );
  });
  it("préserve l’anonymisation historique et efface aussi les notes privées", async () => {
    const client = (await mutate("client_save", {
      ...person,
      email: "anonymise@example.invalid",
      notes: "Privé",
    })) as { id: string };
    await pg.query("select public.admin_mutate($1,'anonymize',$2)", [
      actor,
      JSON.stringify({ id: client.id, confirmed: true }),
    ]);
    expect(
      (
        await pg.query(
          "select first_name,email,phone,notes from public.clients where id=$1",
          [client.id],
        )
      ).rows[0],
    ).toEqual({ first_name: "Anonymisée", email: "", phone: "", notes: "" });
  });
  it("refuse les RPC de gestion aux rôles publics et aux non-administrateurs", async () => {
    await pg.exec("set role anon");
    await expect(
      pg.query("select public.management_snapshot($1)", [actor]),
    ).rejects.toThrow();
    await pg.exec("reset role");
    await pg.exec("set role authenticated");
    await expect(
      pg.query("select public.management_mutate($1,$2)", [actor, "{}"]),
    ).rejects.toThrow();
    await pg.exec("reset role");
    expect(
      (await pg.query("select * from public.admin_users")).rows,
    ).toHaveLength(1);
  });
});
