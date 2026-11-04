// Read-only diagnostic. Never calls snapshot(), availability(), login or mutating RPCs.
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const project = "qnmpfswaeexpchietwzf";
const names = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_ACCESS_TOKEN",
];
const variables = Object.fromEntries(
  names.map((name) => [name, { present: !!process.env[name]?.trim() }]),
);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
function keyKind(key) {
  if (!key) return "absent";
  if (key.startsWith("sb_publishable_")) return "publishable";
  if (key.startsWith("sb_secret_")) return "secret";
  try {
    const payload = JSON.parse(
      Buffer.from(key.split(".")[1], "base64url").toString(),
    );
    return ["anon", "service_role"].includes(payload.role)
      ? payload.role
      : "unknown";
  } catch {
    return "unknown";
  }
}
const targetMatches =
  !!url && url.replace(/\/$/, "") === `https://${project}.supabase.co`;
const report = {
  project,
  variables,
  targetMatches,
  publicKeyKind: keyKind(publicKey),
  serverKeyKind: keyKind(secret),
  provider: process.env.DATA_PROVIDER || "supabase",
  paymentProvider: process.env.PAYMENT_PROVIDER || "stripe",
};
console.log(JSON.stringify(report, null, 2));
if (
  !targetMatches ||
  !["publishable", "anon"].includes(report.publicKeyKind) ||
  !["secret", "service_role"].includes(report.serverKeyKind)
) {
  process.exitCode = 1;
} else if (process.argv.includes("--read-remote")) {
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(10000) }),
    },
  });
  const tables = [
    "admin_users",
    "categories",
    "services",
    "products",
    "clients",
    "bookings",
    "booking_lines",
    "payments",
    "time_allocations",
    "business_hours",
    "special_hours",
    "contact_messages",
    "notification_outbox",
    "management_notifications",
    "admin_audit_log",
    "webhook_events",
    "local_import_archives",
    "local_import_runs",
    "generated_days",
    "site_settings",
    "rate_limits",
  ];
  const counts = {};
  for (const table of tables) {
    const { count, error } = await client
      .from(table)
      .select("*", { head: true, count: "exact" });
    counts[table] = error
      ? { ok: false, code: error.code }
      : { ok: true, count };
  }
  if (Object.values(counts).some((result) => !result.ok)) process.exitCode = 1;
  const { data: services, error: serviceError } = await client
    .from("services")
    .select(
      "id,slug,name,category_id,price_cents,duration_minutes,visibility,bookable,operational_status,qualification_requirement,qualification_verified_at,procedure_verified_at",
    );
  const { data: settings, error: settingsError } = await client
    .from("site_settings")
    .select("value")
    .eq("id", 1)
    .maybeSingle();
  const safeSettings = Object.fromEntries(
    [
      "bookingEnabled",
      "pricesValidated",
      "legalReady",
      "privacyReady",
      "checkoutMinutes",
      "holdMinutes",
      "noticeHours",
      "horizonDays",
      "slotStepMinutes",
    ].map((name) => [name, settings?.value?.[name] ?? null]),
  );
  console.log(
    JSON.stringify(
      {
        counts,
        services: serviceError ? { code: serviceError.code } : services,
        settings: settingsError ? { code: settingsError.code } : safeSettings,
      },
      null,
      2,
    ),
  );
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: publicKey },
      signal: AbortSignal.timeout(10000),
    });
    const auth = await response.json();
    console.log(
      JSON.stringify({
        authSettingsReadable: response.ok,
        disableSignup: auth.disable_signup,
        externalEmailEnabled: auth.external?.email,
      }),
    );
  } catch {
    console.log(JSON.stringify({ authSettingsReadable: false }));
  }
}
