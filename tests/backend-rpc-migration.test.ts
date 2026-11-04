import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type {
  BackendRpcContracts,
  ManagementSnapshotQuery,
} from "@/lib/data/supabase-rpc-contracts";
const migration = "20261031085519_backend_rpc_contract_alignment.sql";
let pg: PGlite;
const actor = "11111111-1111-4111-8111-111111111111";
const baseline: Array<{
  query: ManagementSnapshotQuery;
  value: BackendRpcContracts["management_snapshot"]["Returns"];
}> = [];
let knownToken: string,
  pendingToken: string,
  pendingId: string,
  expectedStatus: unknown;
let catalogue: BackendRpcContracts["repository_catalogue"]["Returns"];
const person = {
  first_name: "Test",
  last_name: "Contrat",
  email: "contract@example.invalid",
  phone: "+33612345678",
};
const when = (days: number) => {
  const t = new Date();
  t.setUTCDate(t.getUTCDate() + days);
  t.setUTCHours(10, 0, 0, 0);
  return t.toISOString();
};
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(
    "create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role bypassrls;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;",
  );
  // The recorded remote versions are data only in this in-memory fixture.
  await pg.exec(
    "create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,name text);insert into supabase_migrations.schema_migrations values('20261030115435','initial_schema'),('20261030115449','local_management_preparation'),('20261030115458','management_repository_parity');",
  );
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql") && f < migration)
    .sort())
    await pg.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  await pg.exec(readFileSync("supabase/seed.sql", "utf8"));
  await pg.exec(
    `insert into auth.users values('${actor}');insert into public.admin_users(user_id) values('${actor}');update public.site_settings set value='{"bookingEnabled":true,"legalReady":true,"privacyReady":true,"pricesValidated":true,"noticeHours":1,"horizonDays":365,"custom_marker":"preserve"}';insert into public.business_hours(weekday,opens,closes) select i,'08:00','20:00' from generate_series(0,6)i;`,
  );
  const make = async (days: number, manual = false) => {
    const result = await pg.query<{
      value: { id: string; public_token: string };
    }>("select public.management_save_booking($1,$2) value", [
      JSON.stringify({
        service_ids: ["00000000-0000-4000-8000-000000000001"],
        start_at: when(days),
        request_id: randomUUID(),
        client: person,
        ...(manual ? { offline_status: "paid_offline" } : {}),
      }),
      manual ? actor : null,
    ]);
    return result.rows[0].value;
  };
  const manual = await make(5, true),
    paid = await make(6);
  const pending = await make(7);
  knownToken = paid.public_token;
  pendingToken = pending.public_token;
  pendingId = pending.id;
  await pg.query("select public.attach_checkout($1,'cs_contract')", [paid.id]);
  await pg.query(
    "select public.process_payment_event('evt_contract','checkout.session.completed','cs_contract','pi_contract',2000,'eur','paid')",
  );
  await pg.exec(
    "update public.payments set checkout_expires_at=null;update public.clients set notes='Note privée';insert into public.contact_messages(first_name,email,subject,message) values('Test','contact@example.invalid','Question','Message privé de test');",
  );
  for (let i = 0; i < 52; i++)
    await pg.query(
      "insert into public.clients(first_name,last_name,email,phone,notes) values('Test',$1,$2,'+33600000000','Privé')",
      [`Paging ${i}`, `paging${i}@example.invalid`],
    );
  const cid = (
    await pg.query<{ client_id: string }>(
      "select client_id from public.bookings where id=$1",
      [manual.id],
    )
  ).rows[0].client_id;
  for (const query of [
    {},
    { section: "" },
    { section: "catalogue" },
    { section: "categories" },
    { section: "lookup", search: "Paging" },
    { section: "lookup", search: "Paging", page: 1 },
    { section: "clientes", clientId: cid },
    { section: "rendez-vous", status: "confirmed", date: when(6).slice(0, 10) },
    {
      section: "planning",
      from: when(1).slice(0, 10),
      to: when(20).slice(0, 10),
    },
    { section: "notifications" },
    { section: "messages" },
    { section: "parametres" },
    { section: "indisponibilites" },
    { section: "horaires" },
  ] as ManagementSnapshotQuery[]) {
    baseline.push({
      query,
      value: (
        await pg.query<{
          value: BackendRpcContracts["management_snapshot"]["Returns"];
        }>("select public.management_snapshot($1,$2) value", [
          actor,
          JSON.stringify(query),
        ])
      ).rows[0].value,
    });
  }
  catalogue = (
    await pg.query<{
      value: BackendRpcContracts["repository_catalogue"]["Returns"];
    }>("select public.repository_catalogue() value")
  ).rows[0].value;
  expectedStatus = (
    await pg.query<{ value: unknown }>(
      "select public.repository_booking_status($1) value",
      [knownToken],
    )
  ).rows[0].value;
  // Reproduce the reported gaps. No source database or hosted Supabase is involved.
  await pg.exec(
    "drop function public.management_snapshot(uuid,jsonb);drop function public.repository_catalogue();drop function public.repository_booking_status(uuid);alter table public.payments drop column checkout_expires_at;",
  );
  // A remote legacy JSON helper must not dictate the new public/private DTOs.
  await pg.exec(
    "create or replace function public.management_public_booking(p_id uuid) returns jsonb language sql as $$select '{\"client\":\"legacy private payload\"}'::jsonb$$;create or replace function public.management_booking_json(p_id uuid) returns jsonb language sql as $$select '{}'::jsonb$$;",
  );
  await pg.exec(readFileSync(`supabase/migrations/${migration}`, "utf8"));
});
afterAll(async () => {
  await pg?.close();
});
it("ajoute seulement la colonne nullable, conserve données/versions et accepte le rejeu", async () => {
  const column = (
    await pg.query(
      "select data_type,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name='payments' and column_name='checkout_expires_at'",
    )
  ).rows[0];
  expect(column).toEqual({
    data_type: "timestamp with time zone",
    is_nullable: "YES",
    column_default: null,
  });
  await pg.exec(readFileSync(`supabase/migrations/${migration}`, "utf8"));
  expect(
    (
      await pg.query<{ version: string }>(
        "select version from supabase_migrations.schema_migrations order by version",
      )
    ).rows.map((r) => r.version),
  ).toEqual(["20261030115435", "20261030115449", "20261030115458"]);
  expect(
    (
      await pg.query<{ n: number }>(
        "select count(*)::int n from public.bookings",
      )
    ).rows[0].n,
  ).toBe(3);
  expect(
    (
      await pg.query<{ n: number }>(
        "select count(*)::int n from public.payments where checkout_expires_at is null",
      )
    ).rows[0].n,
  ).toBe(2);
});
it("reproduit les JSON de référence sur toutes les rubriques, filtres et pages", async () => {
  await pg.exec("set role service_role");
  try {
    for (const { query, value } of baseline)
      expect(
        (
          await pg.query<{ value: unknown }>(
            "select public.management_snapshot($1,$2) value",
            [actor, JSON.stringify(query)],
          )
        ).rows[0].value,
        JSON.stringify(query),
      ).toEqual(value);
    expect(
      (
        await pg.query<{ value: unknown }>(
          "select public.repository_catalogue() value",
        )
      ).rows[0].value,
    ).toEqual(catalogue);
    expect(
      (
        await pg.query<{ value: unknown }>(
          "select public.management_snapshot($1) value",
          [actor],
        )
      ).rows[0].value,
    ).toEqual(baseline[0].value);
  } finally {
    await pg.exec("reset role");
  }
});
it("réserve les trois RPC au backend même pour une session Auth administratrice", async () => {
  for (const role of ["anon", "authenticated"]) {
    await pg.exec(`set role ${role}`);
    try {
      await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [
        actor,
      ]);
      await expect(
        pg.query("select public.management_snapshot($1)", [actor]),
      ).rejects.toThrow();
      await expect(
        pg.query("select public.repository_catalogue()"),
      ).rejects.toThrow();
      await expect(
        pg.query("select public.repository_booking_status($1)", [knownToken]),
      ).rejects.toThrow();
    } finally {
      await pg.exec("reset role");
    }
  }
  const definitions = await pg.query<{
    proname: string;
    prosecdef: boolean;
    provolatile: string;
  }>(
    "select proname,prosecdef,provolatile from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname='public' and proname in ('management_snapshot','repository_catalogue','repository_booking_status') order by proname",
  );
  expect(definitions.rows).toEqual([
    { proname: "management_snapshot", prosecdef: false, provolatile: "v" },
    {
      proname: "repository_booking_status",
      prosecdef: false,
      provolatile: "v",
    },
    { proname: "repository_catalogue", prosecdef: false, provolatile: "s" },
  ]);
  const signatures = await pg.query<{
    proname: string;
    args: string[] | null;
    types: string;
    result: string;
    proretset: boolean;
    defaults: number;
  }>(
    "select proname,proargnames[1:pronargs] args,oidvectortypes(proargtypes) types,prorettype::regtype::text result,proretset,pronargdefaults::int defaults from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname='public' and proname in ('management_snapshot','repository_catalogue','repository_booking_status') order by proname",
  );
  expect(signatures.rows).toEqual([
    {
      proname: "management_snapshot",
      args: ["p_actor", "p_query"],
      types: "uuid, jsonb",
      result: "jsonb",
      proretset: false,
      defaults: 1,
    },
    {
      proname: "repository_booking_status",
      args: ["p_token"],
      types: "uuid",
      result: "jsonb",
      proretset: false,
      defaults: 0,
    },
    {
      proname: "repository_catalogue",
      args: null,
      types: "",
      result: "jsonb",
      proretset: false,
      defaults: 0,
    },
  ]);
});
it("renvoie les neuf champs publics et null pour un jeton inconnu, sans helper hérité", async () => {
  await pg.exec("set role service_role");
  try {
    const result = (
      await pg.query<{
        value: BackendRpcContracts["repository_booking_status"]["Returns"];
      }>("select public.repository_booking_status($1) value", [knownToken])
    ).rows[0].value;
    expect(result).toEqual(expectedStatus);
    expect(Object.keys(result!).sort()).toEqual(
      [
        "id",
        "public_token",
        "service_name",
        "price_cents",
        "status",
        "start_at",
        "end_at",
        "payment_status",
        "payment_provider",
      ].sort(),
    );
    expect(
      (
        await pg.query<{ value: unknown }>(
          "select public.repository_booking_status($1) value",
          [randomUUID()],
        )
      ).rows[0].value,
    ).toBeNull();
  } finally {
    await pg.exec("reset role");
  }
});
it("refuse l’acteur inconnu avant tout effet de bord, puis expire le hold au statut public", async () => {
  await pg.query(
    "update public.time_allocations set expires_at=now()-interval '1 minute' where id=(select allocation_id from public.bookings where id=$1)",
    [pendingId],
  );
  await pg.exec("set role service_role");
  try {
    await expect(
      pg.query("select public.management_snapshot($1)", [randomUUID()]),
    ).rejects.toThrow("UNAUTHORIZED");
    await expect(
      pg.query("select public.management_snapshot(null)"),
    ).rejects.toThrow("UNAUTHORIZED");
    expect(
      (
        await pg.query<{ status: string }>(
          "select status from public.bookings where id=$1",
          [pendingId],
        )
      ).rows[0].status,
    ).toBe("pending");
    expect(
      (
        await pg.query<{ value: unknown }>(
          "select public.repository_booking_status($1) value",
          [pendingToken],
        )
      ).rows[0].value,
    ).toMatchObject({ status: "expired", payment_status: "expired" });
  } finally {
    await pg.exec("reset role");
  }
});
it("refuse une surcharge incompatible au lieu de supprimer un objet existant", async () => {
  await pg.exec(
    "create function public.repository_catalogue(p_debug boolean) returns jsonb language sql as $$select '{}'::jsonb$$;",
  );
  try {
    await expect(
      pg.exec(readFileSync(`supabase/migrations/${migration}`, "utf8")),
    ).rejects.toThrow("Unexpected existing signature");
    await pg.exec("rollback");
    expect(
      (
        await pg.query<{ exists: boolean }>(
          "select to_regprocedure('public.repository_catalogue(boolean)') is not null as exists",
        )
      ).rows[0].exists,
    ).toBe(true);
  } finally {
    await pg.exec("drop function public.repository_catalogue(boolean)");
  }
});
