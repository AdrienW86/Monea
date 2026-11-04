import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
const file = ".env.local";
let text = existsSync(file) ? readFileSync(file, "utf8") : "";
const values = {
  DATA_PROVIDER: "local",
  PAYMENT_PROVIDER: "mock",
  NEXT_PUBLIC_APP_URL: "http://localhost:3210",
  LOCAL_DATABASE_PATH: ".local/data/monea-development.sqlite",
  LOCAL_ADMIN_EMAIL: "admin@monea.local",
  LOCAL_ADMIN_PASSWORD: randomBytes(18).toString("base64url"),
  LOCAL_SESSION_SECRET: randomBytes(32).toString("hex"),
  RATE_LIMIT_SALT: randomBytes(32).toString("hex"),
  ENABLE_EXTERNAL_NOTIFICATIONS: "false",
};
for (const [key, value] of Object.entries(values)) {
  const line = new RegExp(`^${key}=(.*)$`, "m");
  const match = text.match(line);
  if (!match) text += `\n${key}=${value}`;
  else if (!match[1].trim()) text = text.replace(line, `${key}=${value}`);
}
writeFileSync(file, text.trim() + "\n", { mode: 0o600 });
console.log(
  "Configuration locale préparée. Identifiants dans .env.local ; aucun secret affiché. Les valeurs existantes ont été conservées. Démarrage : npm run dev -- --port 3210",
);
