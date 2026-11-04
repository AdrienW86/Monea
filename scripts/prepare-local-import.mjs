import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { validateExport } from "./local-transfer.mjs";
const input = process.argv[2];
if (!input)
  throw Error("Usage : npm run local:prepare-import -- chemin/export.json");
const raw = readFileSync(input, "utf8");
const envelope = JSON.parse(raw);
validateExport(envelope);
if (
  envelope.schema_version !== 2 ||
  envelope.source !== "local" ||
  !envelope.data
)
  throw Error("Export local version 2 requis.");
const data = envelope.data;
for (const key of [
  "categories",
  "services",
  "products",
  "clients",
  "allocations",
  "bookings",
  "notifications",
  "messages",
  "audit",
]) {
  if (!Array.isArray(data[key])) throw Error("Collection manquante : " + key);
  const ids = data[key].map((v) => v.id);
  if (new Set(ids).size !== ids.length)
    throw Error("Identifiants dupliqués : " + key);
}
const sets = Object.fromEntries(
  ["categories", "services", "clients", "allocations"].map((k) => [
    k,
    new Set(data[k].map((v) => v.id)),
  ]),
);
for (const s of [...data.services, ...data.products])
  if (!sets.categories.has(s.category_id)) throw Error("Catégorie manquante.");
for (const b of data.bookings) {
  if (
    !sets.clients.has(b.client_id) ||
    !sets.allocations.has(b.allocation_id) ||
    !b.lines.length ||
    b.lines.some((l) => !sets.services.has(l.service_id))
  )
    throw Error("Référence de rendez-vous invalide.");
  if (b.payment && b.payment.provider !== "mock")
    throw Error("Paiement externe inattendu dans cet export local.");
}
const hash = createHash("sha256").update(raw).digest("hex");
const delimiter = "$local_" + randomUUID().replaceAll("-", "") + "$";
const sql = `-- Archive privée intégrale, sans promotion ni notification et sans paiement réel.\nBEGIN;\nINSERT INTO public.local_import_archives(source,schema_version,sha256,payload) VALUES ('local',2,'${hash}',${delimiter}${JSON.stringify(envelope)}${delimiter}::jsonb) ON CONFLICT(sha256) DO NOTHING;\nCOMMIT;\n`;
const folder = path.resolve(".local/migration");
mkdirSync(folder, { recursive: true });
const output = path.join(folder, "archive-" + hash.slice(0, 12) + ".sql");
writeFileSync(output, sql, { mode: 0o600 });
writeFileSync(
  path.join(folder, "manifest-" + hash.slice(0, 12) + ".json"),
  JSON.stringify(
    {
      sha256: hash,
      source: "local",
      counts: Object.fromEntries(
        Object.entries(data)
          .filter(([, v]) => Array.isArray(v))
          .map(([k, v]) => [k, v.length]),
      ),
      fictive_bookings: data.bookings.filter((b) => b.demo).length,
      mock_payments: data.bookings.filter((b) => b.payment).length,
      promoted: false,
    },
    null,
    2,
  ),
);
console.log(
  "Archive et manifeste préparés dans .local/migration/. Aucun accès distant. La promotion des données utiles nécessite une recette séparée.",
);
