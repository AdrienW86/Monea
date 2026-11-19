import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { LocalRepository } from "@/lib/data/local";
import { updateLocalCatalogue } from "../scripts/update-local-catalogue.mjs";
import update from "@/config/catalogue-update.json";

let repo: LocalRepository;
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  repo = new LocalRepository(":memory:");
});
afterEach(() => {
  repo.close();
  vi.unstubAllEnvs();
});

it("regroupe les anciennes catégories, applique les huit tarifs puis préserve les éditions admin", async () => {
  const categoryId = randomUUID();
  const category = {
    id: categoryId,
    name: "Le corps",
    description: "",
    image: "",
    sort_order: 1,
    active: true,
    demo: false,
  };
  repo.connection
    .prepare("INSERT INTO categories VALUES(?,?)")
    .run(categoryId, JSON.stringify(category));
  const waxing = (await repo.services()).find((s) => s.slug === "epilation")!;
  repo.connection
    .prepare("UPDATE services SET category_id=?,data=? WHERE id=?")
    .run(
      categoryId,
      JSON.stringify({
        ...waxing,
        category: "Le corps",
        category_id: categoryId,
      }),
      waxing.id,
    );
  const id = randomUUID();
  repo.connection
    .prepare("INSERT INTO products VALUES(?,?,?)")
    .run(id, categoryId, JSON.stringify({ id, category_id: categoryId }));
  updateLocalCatalogue(repo.connection);
  expect((await repo.categories()).map((c) => c.name)).toEqual(
    update.categories,
  );
  const services = await repo.services();
  expect(
    services
      .filter((s) => s.category === "Épilation")
      .map((s) => ({ slug: s.slug, name: s.name, price_cents: s.price_cents })),
  ).toEqual(update.waxing);
  expect(services.find((s) => s.slug === "epilation")?.id).toBe(waxing.id);
  expect(services.every((s) => update.categories.includes(s.category))).toBe(
    true,
  );
  const renamed = {
    ...services.find((s) => s.slug === "epilation")!,
    name: "Nom personnalisé",
    price_cents: 600,
  };
  repo.connection
    .prepare("UPDATE services SET data=? WHERE id=?")
    .run(JSON.stringify(renamed), renamed.id);
  expect(updateLocalCatalogue(repo.connection)).toEqual({
    alreadyApplied: true,
  });
  expect(
    (await repo.services()).find((s) => s.id === waxing.id)?.price_cents,
  ).toBe(600);
});

it("supprime une prestation sans historique et libère sa catégorie", async () => {
  const actor = "test-admin";
  const category = (await repo.categories())[0];
  const service = (await repo.services()).find(
    (s) => s.category_id === category.id,
  )!;
  await repo.mutate(
    { action: "service_delete", data: { id: service.id, confirmed: true } },
    actor,
  );
  expect((await repo.services()).some((s) => s.id === service.id)).toBe(false);
  await expect(
    repo.mutate({ action: "service_delete", data: { id: service.id } }, actor),
  ).rejects.toThrow();
});
