import { DatabaseSync } from "node:sqlite";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  existsSync,
  readdirSync,
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
export function validateExport(envelope) {
  if (
    envelope.schema_version !== 2 ||
    envelope.source !== "local" ||
    !envelope.data
  )
    throw Error("Export local version 2 requis.");
  const d = envelope.data;
  for (const table of [
    "categories",
    "services",
    "products",
    "clients",
    "allocations",
    "bookings",
    "hours",
    "special",
    "notifications",
    "messages",
    "audit",
  ]) {
    if (!Array.isArray(d[table]))
      throw Error(`Collection manquante : ${table}`);
    const ids = d[table].map((r) => (table === "special" ? r.date : r.id));
    if (new Set(ids).size !== ids.length)
      throw Error(`Identifiants dupliqués : ${table}`);
  }
  const uuid =
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  for (const table of [
    "categories",
    "services",
    "products",
    "clients",
    "allocations",
    "bookings",
    "notifications",
    "messages",
    "audit",
  ])
    for (const r of d[table])
      if (!uuid.test(r.id)) throw Error(`UUID invalide : ${table}`);
  const set = (key) => new Set(d[key].map((r) => r.id));
  const categories = set("categories"),
    services = set("services"),
    clients = set("clients"),
    allocations = set("allocations");
  for (const row of [...d.services, ...d.products])
    if (!categories.has(row.category_id)) throw Error("Catégorie manquante.");
  const requests = new Set(),
    tokens = new Set(),
    allocationIds = new Set();
  for (const b of d.bookings) {
    if (
      !clients.has(b.client_id) ||
      !allocations.has(b.allocation_id) ||
      !b.lines?.length ||
      b.lines.some((l) => !services.has(l.service_id) || !uuid.test(l.id))
    )
      throw Error("Référence de rendez-vous invalide.");
    for (const [key, values] of [
      ["request_id", requests],
      ["public_token", tokens],
      ["allocation_id", allocationIds],
    ]) {
      if (!uuid.test(b[key]) || values.has(b[key]))
        throw Error(`Identifiant de rendez-vous invalide : ${key}`);
      values.add(b[key]);
    }
    if (
      !Number.isInteger(b.price_cents) ||
      !Number.isInteger(b.duration_minutes) ||
      b.lines.reduce((n, l) => n + l.price_cents, 0) !== b.price_cents ||
      b.lines.reduce((n, l) => n + l.duration_minutes, 0) !== b.duration_minutes
    )
      throw Error("Lignes historiques incohérentes.");
    if (
      b.payment &&
      (b.payment.provider !== "mock" ||
        !uuid.test(b.payment.id) ||
        b.payment.amount_cents !== b.price_cents)
    )
      throw Error("Paiement local non explicitement fictif.");
  }
  const active = d.allocations.filter((a) => a.state === "active");
  for (const a of d.allocations)
    if (
      !Number.isFinite(Date.parse(a.start_at)) ||
      !Number.isFinite(Date.parse(a.end_at)) ||
      Date.parse(a.start_at) >= Date.parse(a.end_at)
    )
      throw Error("Allocation invalide.");
  for (let i = 0; i < active.length; i++)
    for (let j = i + 1; j < active.length; j++)
      if (
        Date.parse(active[i].start_at) < Date.parse(active[j].end_at) &&
        Date.parse(active[i].end_at) > Date.parse(active[j].start_at)
      )
        throw Error("Allocations actives en conflit.");
  return envelope;
}
function extract(database) {
  const rows = (table) =>
    database
      .prepare(`SELECT data FROM ${table} ORDER BY id`)
      .all()
      .map((r) => JSON.parse(r.data));
  const clients = rows("clients"),
    payments = rows("payments"),
    allocations = database
      .prepare("SELECT * FROM time_allocations ORDER BY id")
      .all()
      .map((a) => ({ ...a, demo: !!a.demo }));
  return {
    settings: rows("settings")[0],
    categories: rows("categories"),
    services: rows("services"),
    products: rows("products"),
    clients,
    allocations,
    bookings: rows("bookings").map((b) => ({
      ...b,
      client: clients.find((c) => c.id === b.client_id),
      allocation: allocations.find((a) => a.id === b.allocation_id),
      payment: payments.find((p) => p.booking_id === b.id) || null,
      lines: database
        .prepare(
          "SELECT data FROM booking_lines WHERE booking_id=? ORDER BY position",
        )
        .all(b.id)
        .map((r) => JSON.parse(r.data)),
    })),
    hours: rows("business_hours"),
    special: rows("special_hours"),
    notifications: rows("notifications"),
    messages: rows("messages"),
    audit: rows("audit"),
    generated: rows("generated_days"),
  };
}
export function prepareTransfer(source, destination) {
  const directory = path.resolve(destination);
  if (existsSync(directory))
    throw Error(
      "Choisissez un nouveau dossier : aucun export existant n’est écrasé.",
    );
  mkdirSync(directory, { recursive: true });
  const backup = path.join(directory, "snapshot.sqlite");
  const original = new DatabaseSync(path.resolve(source), { readOnly: true });
  try {
    original.prepare("VACUUM INTO ?").run(backup);
  } finally {
    original.close();
  }
  // VACUUM INTO materializes a complete, consistent snapshot including committed WAL pages.
  const restored = path.join(directory, "restoration-test.sqlite");
  copyFileSync(backup, restored);
  const database = new DatabaseSync(restored, { readOnly: true });
  let data;
  try {
    if (
      database.prepare("PRAGMA integrity_check").get().integrity_check !==
        "ok" ||
      database.prepare("PRAGMA foreign_key_check").all().length
    )
      throw Error("Restauration non conforme.");
    data = extract(database);
  } finally {
    database.close();
  }
  const media = [];
  const referenced = new Set(
    [
      ...data.services,
      ...data.products,
      ...data.categories,
      { image: data.settings.heroImage },
      { image: data.settings.logo },
    ]
      .map((r) => r.image)
      .filter((p) => p?.startsWith("/assets/uploads/")),
  );
  // Preserve unreferenced uploads too, without executing network or Storage operations.
  const uploads = "public/assets/uploads";
  if (existsSync(uploads))
    for (const file of readdirSync(uploads))
      if (/^[a-f0-9-]{36}\.webp$/.test(file))
        referenced.add(`/assets/uploads/${file}`);
  for (const url of referenced) {
    if (!/^\/assets\/uploads\/[a-f0-9-]{36}\.webp$/.test(url))
      throw Error("Chemin média invalide.");
    const bytes = readFileSync(`public${url}`);
    const file = path.basename(url);
    mkdirSync(path.join(directory, "media"), { recursive: true });
    writeFileSync(path.join(directory, "media", file), bytes);
    media.push({ path: url, file, sha256: sha256(bytes), bytes: bytes.length });
  }
  const envelope = validateExport({
    schema_version: 2,
    source: "local",
    exported_at: new Date().toISOString(),
    data,
    media,
  });
  const text = JSON.stringify(envelope, null, 2);
  writeFileSync(path.join(directory, "export.json"), text, { mode: 0o600 });
  const manifest = {
    sha256: sha256(text),
    backup_sha256: sha256(readFileSync(backup)),
    restoration_sha256: sha256(readFileSync(restored)),
    restoration_verified: true,
    counts: Object.fromEntries(
      Object.entries(data)
        .filter(([, v]) => Array.isArray(v))
        .map(([k, v]) => [k, v.length]),
    ),
    media,
  };
  writeFileSync(
    path.join(directory, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    { mode: 0o600 },
  );
  return manifest;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const source = process.argv[2] || ".local/data/monea-development.sqlite";
  const destination =
    process.argv[3] || `.local/migration/transfer-${randomUUID()}`;
  console.log(
    JSON.stringify(
      { destination, ...prepareTransfer(source, destination) },
      null,
      2,
    ),
  );
}
