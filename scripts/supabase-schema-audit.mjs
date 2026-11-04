// Hosted audit: GET/HEAD only. SQL migrations execute exclusively in ephemeral PGlite.
import nextEnv from "@next/env";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
if (url !== "https://qnmpfswaeexpchietwzf.supabase.co" || !key || !publicKey)
  throw Error(
    "Configuration absente ou cible inattendue. Aucune requête envoyée.",
  );
async function read(route, privileged = true, headers = {}, method = "GET") {
  try {
    const response = await fetch(`${url}${route}`, {
      method,
      headers: {
        apikey: privileged ? key : publicKey,
        ...(privileged ? { Authorization: `Bearer ${key}` } : {}),
        ...headers,
      },
      signal: AbortSignal.timeout(12000),
    });
    const body =
      method === "HEAD" ? null : await response.json().catch(() => null);
    return { status: response.status, ok: response.ok, body };
  } catch {
    return { status: 0, ok: false, body: null };
  }
}
const [schema, anonymous, history, authUsers, columnProbe] = await Promise.all([
  read("/rest/v1/", true, { Accept: "application/openapi+json" }),
  read("/rest/v1/", false, { Accept: "application/openapi+json" }),
  read("/rest/v1/schema_migrations?select=version,name&order=version", true, {
    "Accept-Profile": "supabase_migrations",
  }),
  read("/auth/v1/admin/users?page=1&per_page=1"),
  read("/rest/v1/payments?select=checkout_expires_at&limit=0"),
]);
const result = {
  project: "qnmpfswaeexpchietwzf",
  remoteRequests: "GET/HEAD only",
  openApiReadable: schema.ok,
  anonymousOpenApiReadable: anonymous.ok,
  history: {
    readable: history.ok,
    status: history.status,
    code: history.body?.code,
    versions: history.ok ? history.body : undefined,
  },
  auth: {
    usersReadable: authUsers.ok,
    totalUsers:
      authUsers.body?.total ??
      (authUsers.ok && authUsers.body?.users?.length === 0 ? 0 : null),
  },
  checkoutExpiryColumn: {
    readable: columnProbe.ok,
    status: columnProbe.status,
    code: columnProbe.body?.code,
  },
  tables: {},
  rpcs: {},
  anonymous: {},
};
if (schema.ok && schema.body?.paths && schema.body?.definitions) {
  const local = new PGlite();
  try {
    await local.exec(
      "create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role bypassrls;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;",
    );
    for (const file of readdirSync("supabase/migrations")
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await local.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
    const expected = await local.query(
      "select table_name,array_agg(column_name order by column_name) as columns from information_schema.columns where table_schema='public' group by table_name order by table_name",
    );
    const tableDiffs = [];
    for (const row of expected.rows) {
      const properties =
        schema.body.definitions[row.table_name]?.properties || {};
      const names = Object.keys(properties);
      const missing = row.columns.filter((name) => !names.includes(name));
      const extra = names.filter((name) => !row.columns.includes(name));
      if (missing.length || extra.length)
        tableDiffs.push({
          table: row.table_name,
          missingColumns: missing,
          extraColumns: extra,
        });
    }
    result.tables = {
      expected: expected.rows.length,
      exposed: expected.rows.filter(
        (row) => schema.body.paths[`/${row.table_name}`],
      ).length,
      matchingColumns: expected.rows.length - tableDiffs.length,
      differences: tableDiffs,
    };
    const rpcNames = [
      "repository_catalogue",
      "repository_booking_status",
      "management_snapshot",
      "management_mutate",
      "management_save_booking",
      "availability",
      "create_booking",
      "attach_checkout",
      "process_payment_event",
      "admin_mutate",
      "assert_admin",
      "service_eligible",
      "expire_holds",
      "take_rate_limit",
      "store_contact",
      "claim_notifications",
    ];
    const functions = await local.query(
      "select proname,proargnames[1:pronargs] as args from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname='public' and proname=any($1::text[])",
      [rpcNames],
    );
    const checks = [];
    for (const fn of functions.rows) {
      const operation = schema.body.paths[`/rpc/${fn.proname}`]?.post;
      let body =
        operation?.parameters?.find((p) => p.in === "body")?.schema || {};
      if (body.$ref?.startsWith("#/definitions/"))
        body = schema.body.definitions[body.$ref.split("/").pop()] || {};
      const actual = Object.keys(body.properties || {});
      const expectedArgs = fn.args || [];
      const missing = expectedArgs.filter((name) => !actual.includes(name));
      const extra = actual.filter((name) => !expectedArgs.includes(name));
      checks.push({
        name: fn.proname,
        present: !!operation,
        missingArgs: missing,
        extraArgs: extra,
      });
    }
    result.rpcs = {
      expected: rpcNames.length,
      matching: checks.filter(
        (c) => c.present && !c.missingArgs.length && !c.extraArgs.length,
      ).length,
      differences: checks.filter(
        (c) => !c.present || c.missingArgs.length || c.extraArgs.length,
      ),
      auxiliaryNotExposed: [
        "management_import_archive",
        "admin_mutate_legacy",
      ].filter((name) => !schema.body.paths[`/rpc/${name}`]),
      exposedNames: Object.keys(schema.body.paths)
        .filter((name) => name.startsWith("/rpc/"))
        .map((name) => name.slice(5))
        .sort(),
    };
    result.anonymous = {
      privateTablesExposed: anonymous.ok
        ? expected.rows
            .filter((row) => anonymous.body?.paths?.[`/${row.table_name}`])
            .map((row) => row.table_name)
        : null,
      privateRpcsExposed: anonymous.ok
        ? rpcNames.filter((name) => anonymous.body?.paths?.[`/rpc/${name}`])
        : null,
    };
  } finally {
    await local.close();
  }
}
// HEAD requests return no customer records, even if permissions are unexpectedly broad.
const probes = {};
for (const table of ["clients", "bookings", "payments", "admin_users"]) {
  const column = table === "admin_users" ? "user_id" : "id";
  const response = await read(
    `/rest/v1/${table}?select=${column}&limit=0`,
    false,
    {},
    "HEAD",
  );
  probes[table] = { status: response.status };
}
result.anonymous.readProbes = probes;
console.log(JSON.stringify(result, null, 2));
if (process.argv.includes("--save-report")) {
  const directory = path.resolve(
    ".local/migration/supabase-readonly-audit-20261030",
  );
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    path.join(directory, "remote-schema-audit.json"),
    JSON.stringify(result, null, 2),
    { mode: 0o600 },
  );
}
if (
  !schema.ok ||
  result.tables.differences?.length ||
  result.rpcs.differences?.length
)
  process.exitCode = 1;
