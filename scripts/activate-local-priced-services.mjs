import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

// Explicit owner request of 4 November 2026: qualifications confirmed and priced services opened.
// Local-only, with backup and audit. Never loads remote credentials or touches Supabase.
if (existsSync(".env")) process.loadEnvFile(".env");
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
  // Node does not replace existing values; CLI environment stays authoritative.
}
if (process.env.DATA_PROVIDER !== "local")
  throw Error("Cette opération est réservée à la base locale.");
const root = path.resolve(".local") + path.sep;
const filename = path.resolve(
  process.env.LOCAL_DATABASE_PATH || ".local/data/monea-development.sqlite",
);
if (!filename.startsWith(root) || !existsSync(filename))
  throw Error("Base locale existante attendue dans .local/.");
const db = new DatabaseSync(filename);
const instant = new Date().toISOString();
const backupDir = path.resolve(".local/backups");
mkdirSync(backupDir, { recursive: true });
const backup = path.join(
  backupDir,
  `avant-ouverture-prestations-${instant.replace(/[:.]/g, "-")}.sqlite`,
);
db.prepare("VACUUM INTO ?").run(backup);
const affected = [];
const copy = JSON.parse(readFileSync("src/config/service-copy.json", "utf8"));
db.exec("BEGIN IMMEDIATE");
try {
  for (const row of db.prepare("SELECT id,data FROM categories").all()) {
    const category = JSON.parse(row.data);
    if (copy.categories[category.name]) {
      category.name = copy.categories[category.name];
      db.prepare("UPDATE categories SET data=? WHERE id=?").run(
        JSON.stringify(category),
        row.id,
      );
    }
  }
  for (const row of db.prepare("SELECT id,data FROM services").all()) {
    const before = JSON.parse(row.data);
    if (!before.visibility) continue;
    const service = { ...before };
    service.description =
      copy.descriptions[service.description] ?? service.description;
    service.category = copy.categories[service.category] ?? service.category;
    if (service.qualification_requirement !== "none")
      service.qualification_verified_at ||= instant;
    if (service.qualification_requirement === "procedure")
      service.procedure_verified_at ||= instant;
    if (service.price_cents !== null) {
      service.bookable = true;
      service.operational_status = "active";
      affected.push(service.slug);
    }
    db.prepare("UPDATE services SET data=? WHERE id=?").run(
      JSON.stringify(service),
      row.id,
    );
    if (JSON.stringify(before) !== JSON.stringify(service)) {
      const audit = {
        id: randomUUID(),
        actor_id: "owner-request",
        action: "owner_confirmed_catalogue",
        entity_id: row.id,
        created_at: instant,
        detail: {
          source:
            "Demande explicite du propriétaire le 04/11/2026 : tous les diplômes requis détenus ; ouvrir les prestations tarifées.",
          before,
          after: service,
        },
      };
      db.prepare("INSERT INTO audit(id,data) VALUES(?,?)").run(
        audit.id,
        JSON.stringify(audit),
      );
    }
  }
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}
db.close();
console.log(
  JSON.stringify(
    { backup, pricedServicesOpened: affected.length, services: affected },
    null,
    2,
  ),
);
