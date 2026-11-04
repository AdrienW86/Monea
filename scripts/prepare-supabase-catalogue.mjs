// Generates a reviewable INSERT-only transaction; never connects to any database.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { validateExport } from "./local-transfer.mjs";
const source = process.argv[2];
if (!source) throw Error("Indiquer le chemin de l’export sauvegardé.");
const raw = readFileSync(source, "utf8"),
  envelope = validateExport(JSON.parse(raw)),
  d = envelope.data;
const hash = createHash("sha256").update(raw).digest("hex");
for (const service of d.services) {
  if (service.qualification_requirement !== "none" && service.bookable)
    throw Error(
      "Prestation réglementée réservable : validation du catalogue requise.",
    );
  if (
    service.qualification_requirement === "equipment" &&
    (service.price_cents !== null || service.operational_status !== "study")
  )
    throw Error("Un équipement doit rester à l'étude sans tarif.");
  const category = d.categories.find((c) => c.id === service.category_id);
  if (service.category !== category?.name)
    throw Error(
      "Libellé de catégorie incohérent : aucun ajustement implicite autorisé.",
    );
}
const sections = {
  categories: "id name description image sort_order active demo",
  services:
    "id slug name category category_id description qualification_requirement qualification_verified_at procedure_verified_at operational_status bookable visibility price_cents duration_minutes sort_order image demo",
};
let sql =
  "-- Prepared for review only. No migration or existing row is overwritten.\n-- Destination: qnmpfswaeexpchietwzf. Do not execute before explicit approval.\n-- ROLLBACK by default; no settings, Auth users, slots, bookings or payments are imported.\nbegin;\nset local lock_timeout='5s';\nset local statement_timeout='30s';\nselect pg_advisory_xact_lock(748201);\nlock table public.categories, public.services in share row exclusive mode;\n";
const payload = {};
for (const [table, definition] of Object.entries(sections)) {
  const fields = definition.split(" ");
  const records = d[table].map((row) =>
    Object.fromEntries(
      fields.map((field) => [
        field,
        row[field] ?? (field === "demo" ? false : null),
      ]),
    ),
  );
  const delimiter = `$review_${randomUUID().replaceAll("-", "")}$`,
    json = JSON.stringify(records);
  payload[table] = records;
  if (json.includes(delimiter)) throw Error("Délimiteur de revue invalide.");
  const projection = (alias) =>
    `jsonb_build_object(${fields.map((field) => `'${field}',${alias}.${field}`).join(",")})`;
  sql += `\n-- ${records.length} ${table}; identical UUIDs are skipped, differences abort.\ndo $check$ begin\n if exists(select 1 from jsonb_populate_recordset(null::public.${table},${delimiter}${json}${delimiter}::jsonb) incoming join public.${table} existing on existing.id=incoming.id where ${projection("incoming")} is distinct from ${projection("existing")}) then raise exception 'Conflit de catalogue : ${table}. Aucune donnée existante ne sera remplacée.'; end if;\nend $check$;\nwith incoming as(select * from jsonb_populate_recordset(null::public.${table},${delimiter}${json}${delimiter}::jsonb))\ninsert into public.${table}(${fields.join(",")}) select ${fields.map((field) => `incoming.${field}`).join(",")} from incoming where not exists(select 1 from public.${table} existing where existing.id=incoming.id);\n`;
  sql += `do $verify$ begin\n if exists(select 1 from jsonb_populate_recordset(null::public.${table},${delimiter}${json}${delimiter}::jsonb) incoming left join public.${table} existing on existing.id=incoming.id where existing.id is null or ${projection("incoming")} is distinct from ${projection("existing")}) then raise exception 'Vérification après insertion non conforme : ${table}'; end if;\nend $verify$;\n`;
}
sql +=
  "\n-- All differences/unique-name collisions roll back the whole import.\nselect count(*) as categories_after from public.categories;\nselect count(*) as services_after from public.services;\nrollback;\n";
const output = path.join(path.dirname(source), "catalogue-review.sql");
writeFileSync(output, sql, { mode: 0o600 });
writeFileSync(
  path.join(path.dirname(source), "catalogue-payload.json"),
  JSON.stringify(payload, null, 2),
  { mode: 0o600 },
);
const safe = (value) =>
  String(value ?? "—")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
const category = new Map(d.categories.map((c) => [c.id, c]));
let review = `# MONÉA — Données du catalogue proposées pour Supabase\n\nDestination : \`qnmpfswaeexpchietwzf\`. Préparation locale uniquement ; aucun import exécuté.\n\nSource : sauvegarde cohérente WAL et restauration vérifiée. SHA-256 de l’export : \`${hash}\`.\n\n## Catégories (${d.categories.length})\n\n| Catégorie | Active | UUID conservé |\n| --- | --- | --- |\n`;
for (const c of d.categories)
  review += `| ${safe(c.name)} | ${c.active ? "Oui" : "Non"} | ${c.id} |\n`;
review += `\n## Prestations (${d.services.length})\n\n**Les ${d.services.filter((s) => s.price_cents === 2000).length} tarifs à 20 € sont provisoires, à confirmer commercialement.** Ils sont conservés tels quels pour cette proposition, sans validation des prix ni ouverture des réservations. Les obligations professionnelles sont conservées, sans attestation ajoutée.\n\n| Prestation | Catégorie | Prix enregistré | Minutes | Qualification requise | Qualification/procédé validés | État | Réservable configuré | Visible |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
for (const s of d.services)
  review += `| ${safe(s.name)} | ${safe(category.get(s.category_id)?.name)} | ${s.price_cents === null ? "Non renseigné" : (s.price_cents / 100).toFixed(2) + " €" + (s.price_cents === 2000 ? " (provisoire)" : "")} | ${s.duration_minutes} | ${s.qualification_requirement} | ${s.qualification_verified_at ? "Oui" : "Non"} / ${s.procedure_verified_at ? "Oui" : "Non"} | ${s.operational_status} | ${s.bookable ? "Oui" : "Non"} | ${s.visibility ? "Oui" : "Non"} |\n`;
const eligible = d.services.filter(
  (s) =>
    s.qualification_requirement === "none" &&
    s.bookable &&
    s.visibility &&
    s.operational_status === "active" &&
    s.price_cents !== null &&
    category.get(s.category_id)?.active,
);
review += `\n${eligible.length} prestations sans restriction professionnelle sont configurées comme réservables. Aucune ouverture globale n’est activée par cet import.\n\n## Hors import\n\nAucun paramètre, horaire, compte Auth, rendez-vous, cliente, paiement, notification ou historique de migration. Les lignes existantes identiques sont conservées ; un UUID différent associé au même nom/slug provoque un conflit à résoudre avant import. Aucune suppression, aucun UPDATE, aucun UPSERT. Le fichier SQL préparé termine par ROLLBACK et n’a pas été exécuté.\n\n## Horaires à valider\n\nLa source contient ${d.hours.length} intervalle d’ouverture et ${d.special.length} exception. Aucune plage réelle n’est inventée. Choisir les jours, heures, pauses et exceptions dans l’administration après validation ; pour le test, approuver une plage future explicite en Europe/Paris.\n\n## Migrations locales à comparer (ne pas réappliquer)\n\n| Version/fichier | SHA-256 local |\n| --- | --- |\n`;
for (const file of readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort())
  review += `| ${file} | ${createHash("sha256")
    .update(readFileSync(path.join("supabase/migrations", file)))
    .digest("hex")} |\n`;
writeFileSync("docs/SUPABASE_CATALOGUE_REVIEW.md", review);
console.log(
  JSON.stringify(
    {
      sourceSha256: hash,
      categories: d.categories.length,
      services: d.services.length,
      eligibleWithoutRegulatedServices: eligible.length,
      sql: output,
      review: "docs/SUPABASE_CATALOGUE_REVIEW.md",
      remoteWrites: false,
    },
    null,
    2,
  ),
);
