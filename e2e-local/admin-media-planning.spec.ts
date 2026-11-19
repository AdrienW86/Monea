import { test, expect, type Page } from "@playwright/test";
import type { Snapshot } from "../src/lib/data/types";
const origin = "http://127.0.0.1:3212";
async function snapshot(page: Page): Promise<Snapshot> {
  const response = await page.request.get("/api/admin/manage");
  expect(response.ok()).toBe(true);
  return response.json();
}
test.beforeEach(async ({ page }) => {
  const response = await page.request.post("/api/admin/login", {
    headers: { origin },
    data: {
      email: "e2e@example.invalid",
      password: process.env.MONEA_E2E_PASSWORD,
    },
  });
  expect(response.ok()).toBe(true);
});

test("gère les images des catégories et des prestations sur le site public", async ({
  page,
}, info) => {
  const name = `Images ${info.project.name}`;
  await page.goto("/admin/categories");
  await page
    .getByRole("button", { name: "Nouvelle catégorie", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nom de la catégorie").fill(name);
  await dialog.getByLabel("Description").fill("Catégorie de test des images");
  const upload = page.waitForResponse((r) =>
    r.url().endsWith("/api/admin/media"),
  );
  await dialog
    .locator('input[type="file"]')
    .setInputFiles("public/images/beauty/spa-epilation-bras-v1.webp");
  expect((await upload).ok()).toBe(true);
  await expect(dialog.getByAltText("Aperçu du visuel")).toBeVisible();
  await dialog
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  let category = (await snapshot(page)).categories.find(
    (c) => c.name === name,
  )!;
  expect((await page.request.get(category.image)).ok()).toBe(true);
  await page.goto("/");
  const family = page.locator(".care-photo-card").filter({ hasText: name });
  await expect(family.locator("img")).toBeVisible();

  await page.goto("/admin/categories");
  await page
    .getByRole("row")
    .filter({ hasText: name })
    .getByRole("button", { name: "Modifier" })
    .click();
  const replace = page.waitForResponse((r) =>
    r.url().endsWith("/api/admin/media"),
  );
  await dialog
    .locator('input[type="file"]')
    .setInputFiles("public/images/beauty/spa-epilation-menton-v1.webp");
  expect((await replace).ok()).toBe(true);
  await dialog
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const previousImage = category.image;
  category = (await snapshot(page)).categories.find((c) => c.name === name)!;
  expect(category.image).not.toBe(previousImage);
  await page
    .getByRole("row")
    .filter({ hasText: name })
    .getByRole("button", { name: "Modifier" })
    .click();
  await dialog
    .getByRole("button", { name: "Supprimer l’image", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.goto("/");
  await expect(family.locator("img")).toHaveCount(0);

  await page.goto("/admin/catalogue");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await dialog.getByLabel("Nom de la prestation").fill(name);
  await dialog
    .getByLabel("Catégorie", { exact: true })
    .selectOption(category.id);
  await dialog.getByLabel("Description").fill("Prestation de test des images");
  await dialog.getByLabel("Prix TTC en euros").fill("5");
  const serviceUpload = page.waitForResponse((r) =>
    r.url().endsWith("/api/admin/media"),
  );
  await dialog
    .locator('input[type="file"]')
    .setInputFiles("public/images/beauty/spa-epilation-bras-v1.webp");
  expect((await serviceUpload).ok()).toBe(true);
  await dialog
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const service = (await snapshot(page)).services.find((s) => s.name === name)!;
  await page.goto(`/prestations/${service.slug}`);
  await expect(page.locator(".service-feature-photo img")).toBeVisible();
  await page.goto("/admin/catalogue");
  await page
    .getByRole("row")
    .filter({ hasText: name })
    .getByRole("button", { name: "Modifier" })
    .click();
  await dialog
    .getByRole("button", { name: "Supprimer l’image", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.goto(`/prestations/${service.slug}`);
  await expect(page.locator(".service-feature-photo")).toHaveCount(0);
  await page.goto("/admin/catalogue");
  await page
    .getByRole("row")
    .filter({ hasText: name })
    .getByRole("button", { name: "Modifier" })
    .click();
  await dialog
    .getByRole("button", { name: "Rétablir l’image par défaut" })
    .click();
  await dialog
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.goto(`/prestations/${service.slug}`);
  await expect(page.locator(".service-feature-photo img")).toBeVisible();
});

test("bloque une heure, une journée, une semaine et un mois depuis le planning", async ({
  page,
}, info) => {
  const year = info.project.name === "local-desktop" ? "2031" : "2032";
  await page.goto("/admin/planning");
  for (const [index, label, start, expectedEnd] of [
    [1, "Une heure", `${year}-01-01T23:30`, `${year}-01-02T00:30`],
    [2, "Une journée", `${year}-02-01`, `${year}-02-02T00:00`],
    [3, "Une semaine", `${year}-03-01`, `${year}-03-08T00:00`],
    [4, "Un mois entier", `${year}-04`, `${year}-05-01T00:00`],
  ] as const) {
    await page
      .getByRole("button", { name: "Bloquer une période", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: label, exact: true }).click();
    await dialog
      .getByLabel(index === 4 ? "Mois à bloquer" : "Début de l’indisponibilité")
      .fill(start);
    await expect(dialog.getByLabel("Reprise des disponibilités")).toHaveValue(
      expectedEnd,
    );
    const reason = `Blocage ${info.project.name} ${label}`;
    await dialog.getByLabel("Motif interne").fill(reason);
    if (index === 4)
      await page.screenshot({
        path: `.local/qa/planning-presets-${info.project.name}.png`,
      });
    await dialog
      .getByRole("button", { name: "Enregistrer l’indisponibilité" })
      .click();
    await expect(dialog).not.toBeVisible();
    expect(
      (await snapshot(page)).allocations.some(
        (a) => a.kind === "block" && a.reason === reason,
      ),
    ).toBe(true);
  }
  await page.goto("/admin/messages");
  await expect(
    page.getByRole("heading", { name: "Messages du formulaire de contact" }),
  ).toBeVisible();
  await expect(
    page.getByText("Cette section n’est pas reliée à votre boîte e-mail.", {
      exact: false,
    }),
  ).toBeVisible();
});
