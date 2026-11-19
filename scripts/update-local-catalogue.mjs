import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

const update = JSON.parse(
  readFileSync(
    new URL("../src/config/catalogue-update.json", import.meta.url),
    "utf8",
  ),
);
const action = "owner_catalogue_2026_11_19";

// One-time owner update. Later admin edits must never be reset on app startup.
export function updateLocalCatalogue(db) {
  db.exec("PRAGMA foreign_keys=ON; BEGIN IMMEDIATE");
  try {
    if (
      db
        .prepare("SELECT id FROM audit WHERE json_extract(data,'$.action')=?")
        .get(action)
    ) {
      db.exec("COMMIT");
      return { alreadyApplied: true };
    }
    const categories = db
      .prepare("SELECT data FROM categories")
      .all()
      .map((r) => JSON.parse(r.data));
    const services = db
      .prepare("SELECT data FROM services")
      .all()
      .map((r) => JSON.parse(r.data));
    const template = services.find((s) => s.slug === "epilation");
    if (!template)
      throw Error("Prestation d’épilation de référence introuvable.");
    const targets = new Map();
    for (const [sort_order, name] of update.categories.entries()) {
      const existing = categories.find((c) => c.name === name);
      const category = {
        description: "",
        image: "",
        active: true,
        demo: false,
        ...existing,
        id: existing?.id || randomUUID(),
        name,
        sort_order,
      };
      targets.set(name, category);
      db.prepare(
        "INSERT INTO categories(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      ).run(category.id, JSON.stringify(category));
    }
    const reassigned = [];
    for (const service of services) {
      const originalCategory =
        categories.find((c) => c.id === service.category_id)?.name ||
        service.category;
      const targetName =
        service.slug === "epilation"
          ? "Épilation"
          : update.legacyCategories[originalCategory] || originalCategory;
      const target = targets.get(targetName);
      if (!target) continue; // Preserve any additional owner-created category.
      const next = {
        ...service,
        category: target.name,
        category_id: target.id,
      };
      db.prepare("UPDATE services SET category_id=?,data=? WHERE id=?").run(
        target.id,
        JSON.stringify(next),
        service.id,
      );
      reassigned.push(service.id);
    }
    for (const [index, waxing] of update.waxing.entries()) {
      const existing = services.find((s) => s.slug === waxing.slug);
      const service = {
        ...template,
        ...existing,
        ...waxing,
        id: existing?.id || randomUUID(),
        category_id: targets.get("Épilation").id,
        category: "Épilation",
        description:
          index === 2
            ? "Épilation des sourcils et de la lèvre supérieure en une même prestation."
            : `${waxing.name} à la cire.`,
        sort_order: index,
      };
      db.prepare(
        "INSERT INTO services(id,slug,category_id,data) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET category_id=excluded.category_id,data=excluded.data",
      ).run(
        service.id,
        service.slug,
        service.category_id,
        JSON.stringify(service),
      );
    }
    for (const category of categories) {
      const target = targets.get(update.legacyCategories[category.name]);
      if (!target || target.id === category.id) continue;
      for (const row of db
        .prepare("SELECT id,data FROM products WHERE category_id=?")
        .all(category.id)) {
        const product = { ...JSON.parse(row.data), category_id: target.id };
        db.prepare("UPDATE products SET category_id=?,data=? WHERE id=?").run(
          target.id,
          JSON.stringify(product),
          row.id,
        );
      }
      db.prepare(
        "DELETE FROM categories WHERE id=? AND NOT EXISTS(SELECT 1 FROM services WHERE category_id=?) AND NOT EXISTS(SELECT 1 FROM products WHERE category_id=?)",
      ).run(category.id, category.id, category.id);
    }
    const audit = {
      id: randomUUID(),
      actor_id: "owner-request",
      action,
      entity_id: targets.get("Épilation").id,
      created_at: new Date().toISOString(),
      detail: {
        categories: update.categories,
        waxing: update.waxing,
        reassigned,
      },
    };
    db.prepare("INSERT INTO audit(id,data) VALUES(?,?)").run(
      audit.id,
      JSON.stringify(audit),
    );
    db.exec("COMMIT");
    return { categories: update.categories, waxing: update.waxing };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  if (existsSync(".env")) process.loadEnvFile(".env");
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  if (process.env.DATA_PROVIDER !== "local")
    throw Error("Mise à jour réservée à la base locale.");
  const filename = path.resolve(
    process.env.LOCAL_DATABASE_PATH || ".local/data/monea-development.sqlite",
  );
  if (
    !filename.startsWith(path.resolve(".local") + path.sep) ||
    !existsSync(filename)
  )
    throw Error("Base existante attendue dans .local/.");
  const db = new DatabaseSync(filename);
  try {
    mkdirSync(".local/backups", { recursive: true });
    const backup = path.resolve(
      `.local/backups/avant-catalogue-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`,
    );
    db.prepare("VACUUM INTO ?").run(backup);
    console.log(
      JSON.stringify({ backup, ...updateLocalCatalogue(db) }, null, 2),
    );
  } finally {
    db.close();
  }
}
