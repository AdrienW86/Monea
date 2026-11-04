import { beforeAll, afterAll, it, expect } from "vitest";
import EmbeddedPostgres from "embedded-postgres";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
let cluster: EmbeddedPostgres;
let first: ReturnType<EmbeddedPostgres["getPgClient"]>;
let second: ReturnType<EmbeddedPostgres["getPgClient"]>;
beforeAll(async () => {
  const root = path.resolve(".local");
  const directory = path.resolve(root, `pg-${randomUUID()}`);
  if (!directory.startsWith(root + path.sep))
    throw Error("Répertoire de test hors workspace");
  cluster = new EmbeddedPostgres({
    databaseDir: directory,
    user: "postgres",
    password: randomUUID(),
    port: 55439,
    persistent: true,
    postgresFlags: ["-h", "127.0.0.1"],
    onLog: () => {},
    onError: () => {},
  });
  await cluster.initialise();
  await cluster.start();
  first = cluster.getPgClient();
  second = cluster.getPgClient();
  await first.connect();
  await second.connect();
  await first.query(
    `create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role bypassrls;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`,
  );
  for (const f of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await first.query(readFileSync(`supabase/migrations/${f}`, "utf8"));
  await first.query(readFileSync("supabase/seed.sql", "utf8"));
  await first.query(
    `update public.site_settings set value='{"bookingEnabled":true,"legalReady":true,"privacyReady":true,"pricesValidated":true,"noticeHours":1,"horizonDays":365}';insert into public.business_hours(weekday,opens,closes) select i,'08:00','20:00' from generate_series(0,6)i;`,
  );
});
afterAll(async () => {
  await first?.end();
  await second?.end();
  if (cluster) await cluster.stop();
});
it("deux connexions PostgreSQL indépendantes : un seul hold gagne la course", async () => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 2);
  date.setUTCHours(10, 0, 0, 0);
  const sql = "select public.create_booking($1,$2,$3,$4)";
  const args = [
    "00000000-0000-4000-8000-000000000001",
    date.toISOString(),
    JSON.stringify({
      first_name: "Test",
      last_name: "Race",
      email: "race@example.invalid",
      phone: "+33600000000",
    }),
  ];
  await first.query("begin");
  await first.query(sql, [...args, randomUUID()]);
  let settled = false;
  const contender = second
    .query(sql, [...args, randomUUID()])
    .then(
      () => ({ ok: true, code: "" }),
      (e: { code: string }) => ({ ok: false, code: e.code }),
    )
    .finally(() => {
      settled = true;
    });
  await new Promise((r) => setTimeout(r, 100));
  expect(settled).toBe(false);
  await first.query("commit");
  expect(await contender).toEqual({ ok: false, code: "23P01" });
  const rows = await first.query("select count(*)::int n from public.bookings");
  expect(rows.rows[0].n).toBe(1);
});
it("conserve réservations, lignes et allocations après arrêt puis redémarrage PostgreSQL", async () => {
  const before = await first.query(
    "select b.id,b.request_id,b.price_cents,a.start_at,(select count(*)::int from public.booking_lines l where l.booking_id=b.id) lines from public.bookings b join public.time_allocations a on a.id=b.allocation_id",
  );
  expect(before.rows).toHaveLength(1);
  expect(before.rows[0].lines).toBe(1);
  await first.end();
  await second.end();
  await cluster.stop();
  await cluster.start();
  first = cluster.getPgClient();
  second = cluster.getPgClient();
  await first.connect();
  await second.connect();
  const after = await first.query(
    "select b.id,b.request_id,b.price_cents,a.start_at,(select count(*)::int from public.booking_lines l where l.booking_id=b.id) lines from public.bookings b join public.time_allocations a on a.id=b.allocation_id",
  );
  expect(after.rows).toEqual(before.rows);
});
