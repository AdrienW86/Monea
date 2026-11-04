import nextEnv from "@next/env";
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  paymentProvider,
  requireStripePayments,
} from "../src/lib/payments/provider.mjs";
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const names = [
  "STRIPE_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
];
const values = Object.fromEntries(
  names.map((name) => [name, process.env[name]?.trim() || ""]),
);
const keys = Object.fromEntries(
  names.map((name) => {
    const value = values[name];
    const pattern = name.includes("WEBHOOK")
      ? /^whsec_[A-Za-z0-9_]+$/
      : name.includes("PUBLISHABLE")
        ? /^pk_test_[A-Za-z0-9_]+$/
        : /^sk_test_[A-Za-z0-9_]+$/;
    return [
      name,
      {
        present: !!value,
        formatValid: pattern.test(value),
        live: /^(sk|pk|rk)_live_/.test(value),
      },
    ];
  }),
);
const conflict = !!(
  values.STRIPE_API_KEY &&
  values.STRIPE_SECRET_KEY &&
  values.STRIPE_API_KEY !== values.STRIPE_SECRET_KEY
);
const liveDetected = Object.values(keys).some((key) => key.live);
console.log(
  JSON.stringify(
    {
      keys,
      secretConflict: conflict,
      liveDetected,
      provider: process.env.DATA_PROVIDER || "supabase",
      paymentProvider: paymentProvider(),
      supabaseConfigured: !!(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
        process.env.SUPABASE_SERVICE_ROLE_KEY
      ),
      appOriginConfigured: !!process.env.NEXT_PUBLIC_APP_URL,
      liveFlagEnabled: process.env.ALLOW_LIVE_PAYMENTS === "true",
    },
    null,
    2,
  ),
);
if (liveDetected || conflict) process.exitCode = 2;
else if (
  !(keys.STRIPE_API_KEY.formatValid || keys.STRIPE_SECRET_KEY.formatValid) ||
  !keys.STRIPE_PUBLISHABLE_KEY.formatValid ||
  !keys.STRIPE_WEBHOOK_SECRET.formatValid
)
  process.exitCode = 1;
if (
  (process.argv.includes("--verify-api") ||
    process.argv.includes("--verify-cli")) &&
  !process.exitCode
) {
  try {
    requireStripePayments();
  } catch {
    console.error(
      "PAYMENT_PROVIDER_DISABLED : aucun appel API/CLI Stripe effectué.",
    );
    process.exitCode = 1;
  }
}
if (process.argv.includes("--verify-api") && !process.exitCode) {
  const { default: Stripe } = await import("stripe");
  try {
    const stripe = new Stripe(
      values.STRIPE_API_KEY || values.STRIPE_SECRET_KEY,
      {
        maxNetworkRetries: 0,
        timeout: 10000,
        httpClient: Stripe.createFetchHttpClient((input, init) => {
          requireStripePayments();
          return fetch(input, init);
        }),
      },
    );
    const balance = await stripe.balance.retrieve();
    console.log(
      JSON.stringify({
        stripeApiReachable: true,
        testModeConfirmed: balance.livemode === false,
      }),
    );
    if (balance.livemode !== false) process.exitCode = 2;
  } catch (error) {
    // Provider messages, request objects and headers may contain sensitive data.
    console.log(
      JSON.stringify({
        stripeApiReachable: false,
        errorType:
          typeof error.type === "string" ? error.type : "connection_failed",
      }),
    );
    process.exitCode = 1;
  }
}
if (process.argv.includes("--verify-cli") && !process.exitCode) {
  const cli =
    process.platform === "win32"
      ? path.join(
          process.env.APPDATA || "",
          "npm/node_modules/@stripe/cli/node_modules/@stripe/cli-win32-x64/bin/stripe.exe",
        )
      : "stripe";
  const result = spawnSync(cli, ["listen", "--print-secret", "--skip-update"], {
    encoding: "utf8",
    timeout: 15000,
    maxBuffer: 1048576,
    windowsHide: true,
    env: {
      ...process.env,
      STRIPE_API_KEY: values.STRIPE_API_KEY || values.STRIPE_SECRET_KEY,
    },
  });
  const secret =
    result.status === 0
      ? result.stdout.match(/whsec_[A-Za-z0-9_]+/)?.[0]
      : undefined;
  const matches = !!secret && secret === values.STRIPE_WEBHOOK_SECRET;
  console.log(
    JSON.stringify({
      stripeCliSecretRetrieved: !!secret,
      webhookSecretMatchesCli: matches,
    }),
  );
  if (!matches) process.exitCode = 1;
}
