// Offline protocol fixture: real PostgreSQL, local Auth/PostgREST HTTP stand-ins.
// Not a production Supabase server. No hosted service or payment provider is contacted.
import EmbeddedPostgres from "embedded-postgres";
import { readFileSync, readdirSync } from "node:fs";
import { createServer } from "node:http";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
const actor = "11111111-1111-4111-8111-111111111111";
const password = process.env.MONEA_E2E_PASSWORD;
if (!password) throw Error("Mot de passe de test requis.");
const databaseDir = path.resolve(".local", `supabase-qa-${randomUUID()}`);
if (!databaseDir.startsWith(path.resolve(".local") + path.sep))
  throw Error("Répertoire de test invalide.");
const cluster = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password: randomBytes(24).toString("hex"),
  port: 55441,
  persistent: true,
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
await cluster.initialise();
await cluster.start();
const root = cluster.getPgClient();
await root.connect();
await root.query(
  "create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role bypassrls;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;",
);
for (const f of readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort())
  await root.query(readFileSync(`supabase/migrations/${f}`, "utf8"));
await root.query(readFileSync("supabase/seed.sql", "utf8"));
await root.query(
  `insert into auth.users values('${actor}');insert into public.admin_users(user_id) values('${actor}');update public.site_settings set value='{"bookingEnabled":true,"pricesValidated":true,"legalReady":true,"privacyReady":true,"noticeHours":1,"horizonDays":365}';insert into public.business_hours(weekday,opens,closes) select i,'08:00','20:00' from generate_series(0,6)i;`,
);
const user = {
  id: actor,
  aud: "authenticated",
  role: "authenticated",
  email: "e2e@example.invalid",
  created_at: new Date().toISOString(),
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  identities: [],
};
const secret = randomBytes(32);
const encode = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: actor, aud: "authenticated", role: "authenticated", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })}`;
const token = `${unsigned}.${createHmac("sha256", secret).update(unsigned).digest("base64url")}`;
const serviceKey = "service-role-offline-fixture";
const http = createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  const send = (status, data) => {
    res.statusCode = status;
    res.end(JSON.stringify(data));
  };
  const url = new URL(req.url, "http://127.0.0.1:3214");
  try {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 1048576) return send(413, {});
    }
    const input = body ? JSON.parse(body) : {};
    if (url.pathname === "/auth/v1/token") {
      if (input.email !== user.email || input.password !== password)
        return send(400, {
          error: "invalid_grant",
          msg: "Identifiants invalides",
        });
      return send(200, {
        access_token: token,
        refresh_token: "offline-refresh",
        token_type: "bearer",
        expires_in: 3600,
        user,
      });
    }
    const authenticated = req.headers.authorization === `Bearer ${token}`;
    if (url.pathname === "/auth/v1/user")
      return send(
        authenticated ? 200 : 401,
        authenticated ? user : { msg: "Non autorisé" },
      );
    if (url.pathname === "/auth/v1/logout") return send(200, {});
    const client = cluster.getPgClient();
    await client.connect();
    try {
      if (url.pathname === "/rest/v1/admin_users") {
        if (!authenticated) return send(401, {});
        await client.query("set role authenticated");
        await client.query(
          "select set_config('request.jwt.claim.sub',$1,false)",
          [actor],
        );
        const result = await client.query(
          "select user_id from public.admin_users where user_id=$1",
          [actor],
        );
        return send(200, result.rows[0] || null);
      }
      if (url.pathname.startsWith("/rest/v1/rpc/")) {
        if (
          req.headers.apikey !== serviceKey ||
          req.headers.authorization !== `Bearer ${serviceKey}`
        )
          return send(403, { code: "42501", message: "Accès refusé" });
        const name = url.pathname.split("/").pop();
        if (
          !/^[a-z_]+$/.test(name) ||
          Object.keys(input).some((k) => !/^p_[a-z_]+$/.test(k))
        )
          return send(400, {});
        await client.query("set role service_role");
        const entries = Object.entries(input),
          args = entries.map(([k], i) => `${k}=>$${i + 1}`).join(",");
        const result = await client.query(
          name === "availability"
            ? `select * from public.${name}(${args})`
            : `select public.${name}(${args}) value`,
          entries.map(([, v]) =>
            v && typeof v === "object" ? JSON.stringify(v) : v,
          ),
        );
        return send(
          200,
          name === "availability"
            ? result.rows
            : (result.rows[0]?.value ?? null),
        );
      }
      return send(404, {});
    } finally {
      await client.end();
    }
  } catch (e) {
    send(e.code === "23P01" ? 409 : 400, {
      code: e.code || "P0001",
      message: e.message,
      details: e.detail,
    });
  }
});
await new Promise((resolve) => http.listen(3214, "127.0.0.1", resolve));
let child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3213",
  ],
  {
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      DATA_PROVIDER: "supabase",
      PAYMENT_PROVIDER: "stripe",
      NEXT_DIST_DIR: ".next-supabase-qa",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3213",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3214",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-offline-fixture",
      SUPABASE_SERVICE_ROLE_KEY: serviceKey,
      RATE_LIMIT_SALT: randomBytes(32).toString("hex"),
      STRIPE_SECRET_KEY: "",
      STRIPE_WEBHOOK_SECRET: "",
      ALLOW_LIVE_PAYMENTS: "false",
      ENABLE_EXTERNAL_NOTIFICATIONS: "false",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  child?.kill();
  child = undefined;
  http.closeAllConnections();
  http.close();
  await root.end();
  await cluster.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", () => {
  if (!stopping) void stop();
});
