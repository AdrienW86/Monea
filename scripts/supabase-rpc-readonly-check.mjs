// GET only: PostgREST enforces READ ONLY even for VOLATILE RPCs.
// Never POST a snapshot/status call: expire_holds() can write.
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
if (
  url !== "https://qnmpfswaeexpchietwzf.supabase.co" ||
  !key ||
  !publicKey ||
  process.env.DATA_PROVIDER !== "local" ||
  process.env.PAYMENT_PROVIDER !== "mock"
)
  throw Error("Configuration/cible inattendue. Aucun appel effectué.");
const timeoutFetch = (input, init) => {
  if ((init?.method || "GET").toUpperCase() !== "GET")
    throw Error("Seules les requêtes GET sont autorisées.");
  return fetch(input, { ...init, signal: AbortSignal.timeout(12000) });
};
const client = (apiKey) =>
  createClient(url, apiKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: timeoutFetch },
  });
const backend = client(key),
  anonymous = client(publicKey);
const response = await timeoutFetch(`${url}/rest/v1/`, {
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/openapi+json",
  },
});
if (!response.ok) throw Error("OpenAPI inaccessible.");
const api = await response.json();
const expected = {
  repository_catalogue: {},
  management_snapshot: { p_actor: "uuid", p_query: "jsonb" },
  repository_booking_status: { p_token: "uuid" },
};
const signatures = {};
for (const [name, args] of Object.entries(expected)) {
  const post = api.paths?.[`/rpc/${name}`]?.post;
  let body = post?.parameters?.find((p) => p.in === "body")?.schema || {};
  if (body.$ref) body = api.definitions?.[body.$ref.split("/").pop()] || {};
  const properties = body.properties || {};
  const required =
    name === "management_snapshot" ? ["p_actor"] : Object.keys(args);
  signatures[name] = {
    present: !!post,
    args: Object.fromEntries(
      Object.entries(properties).map(([k, v]) => [
        k,
        { type: v.type, format: v.format },
      ]),
    ),
    required: body.required || [],
    returnSchema: post?.responses?.["200"]?.schema,
    matching:
      !!post &&
      [...(body.required || [])].sort().join(",") ===
        required.sort().join(",") &&
      Object.keys(properties).length === Object.keys(args).length &&
      Object.entries(args).every(
        ([k, format]) => properties[k]?.format === format,
      ),
  };
}
// Fixed absent identifiers: never read an existing customer's token or create an admin.
const args = {
  repository_catalogue: {},
  // GET query parameters require textual JSON; the Next.js POST adapter sends an object.
  management_snapshot: {
    p_actor: "00000000-0000-4000-8000-000000000000",
    p_query: JSON.stringify({ section: "lookup", page: 0, search: "" }),
  },
  repository_booking_status: {
    p_token: "00000000-0000-4000-8000-000000000000",
  },
};
const checks = {};
for (const name of Object.keys(args)) {
  const { data, error, status } = await backend.rpc(name, args[name], {
    get: true,
  });
  const { error: denied, status: anonymousStatus } = await anonymous.rpc(
    name,
    args[name],
    { get: true },
  );
  const contract =
    name === "repository_catalogue"
      ? !error &&
        data &&
        !Array.isArray(data) &&
        Object.keys(data).sort().join(",") === "categories,services,settings" &&
        Array.isArray(data.services) &&
        Array.isArray(data.categories) &&
        (data.settings === null ||
          (typeof data.settings === "object" && !Array.isArray(data.settings)))
      : name === "management_snapshot"
        ? error?.code === "P0001" && error.message === "UNAUTHORIZED"
        : error?.code === "25006" || (!error && data === null);
  checks[name] = {
    backend: { status, code: error?.code ?? null, expectedOutcome: !!contract },
    fullResultVerified: name === "repository_catalogue" ? !!contract : !error,
    anonymous: {
      status: anonymousStatus,
      code: denied?.code ?? null,
      denied: !!denied && [401, 403, 404].includes(anonymousStatus),
    },
    ...(name === "repository_catalogue" && !error
      ? {
          shape: {
            keys: Object.keys(data).sort(),
            categories: data.categories.length,
            services: data.services.length,
          },
        }
      : {}),
  };
}
console.log(
  JSON.stringify(
    {
      project: "qnmpfswaeexpchietwzf",
      method: "GET only / READ ONLY",
      signatures,
      checks,
    },
    null,
    2,
  ),
);
if (
  Object.values(signatures).some((v) => !v.matching) ||
  Object.values(checks).some(
    (v) => !v.backend.expectedOutcome || !v.anonymous.denied,
  )
)
  process.exitCode = 1;
