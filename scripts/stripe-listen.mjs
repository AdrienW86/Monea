// Loads the existing values and prints only the masked diagnostic.
import "./stripe-check.mjs";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import path from "node:path";
import { requireStripePayments } from "../src/lib/payments/provider.mjs";
if (process.exitCode) process.exit(process.exitCode);
try {
  requireStripePayments();
} catch {
  console.error("PAYMENT_PROVIDER_DISABLED : listener Stripe non démarré.");
  process.exit(1);
}
if (
  process.env.DATA_PROVIDER === "local" ||
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  console.error(
    "Listener non démarré : prévoir un environnement Supabase de recette configuré. SQLite/mock reste inchangé.",
  );
  process.exit(1);
}
const origin = new URL(process.env.NEXT_PUBLIC_APP_URL);
if (!["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname))
  throw Error("Le listener accepte uniquement une origine locale.");
const cli =
  process.platform === "win32"
    ? path.join(
        process.env.APPDATA || "",
        "npm/node_modules/@stripe/cli/node_modules/@stripe/cli-win32-x64/bin/stripe.exe",
      )
    : "stripe";
const child = spawn(
  cli,
  [
    "listen",
    "--skip-update",
    "--events",
    "checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,charge.refunded",
    "--forward-to",
    `${origin.origin}/api/webhooks/stripe`,
  ],
  {
    windowsHide: true,
    env: {
      ...process.env,
      STRIPE_API_KEY: (
        process.env.STRIPE_API_KEY || process.env.STRIPE_SECRET_KEY
      ).trim(),
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
for (const stream of [child.stdout, child.stderr])
  createInterface({ input: stream }).on("line", (line) => {
    const secret = line.match(/whsec_[A-Za-z0-9_]+/)?.[0];
    if (secret && secret !== process.env.STRIPE_WEBHOOK_SECRET?.trim()) {
      console.error(
        "Secret listener différent de STRIPE_WEBHOOK_SECRET : arrêt, aucune valeur affichée.",
      );
      child.kill();
      process.exitCode = 1;
      return;
    }
    console.log(
      line.replace(
        /(?:sk|pk|rk)_(?:test|live)_[A-Za-z0-9_]+|whsec_[A-Za-z0-9_]+/g,
        "[MASQUÉ]",
      ),
    );
  });
child.on("error", () => {
  console.error("Stripe CLI indisponible.");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  if (!process.exitCode) process.exitCode = code || 0;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill());
