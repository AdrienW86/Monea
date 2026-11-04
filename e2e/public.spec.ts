import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("accessibilité et capture visuelle", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.screenshot({
    path: `docs/screenshots/accueil-${testInfo.project.name}.png`,
    fullPage: true,
  });
  for (const url of [
    "/",
    "/prestations",
    "/reservation",
    "/contact",
    "/admin/connexion",
    "/confidentialite",
  ]) {
    await page.goto(url);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
      url,
    ).toEqual([]);
  }
});
test("accueil, navigation et catalogue complet", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Prenez du temps",
  );
  await page.getByRole("link", { name: "Tout le catalogue" }).click();
  await expect(page.locator(".service-card")).toHaveCount(16);
  await page.getByRole("button", { name: "Les ongles", exact: true }).click();
  await expect(page.locator(".service-card")).toHaveCount(1);
  await page
    .getByRole("link", { name: "Prothésie ongulaire", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Prothésie",
  );
});
test("réservation fermée honnêtement sans intégrations", async ({ page }) => {
  await page.goto("/reservation");
  await expect(
    page.getByRole("button", { name: "Paiement indisponible pour le moment" }),
  ).toBeDisabled();
  await expect(page.locator(".day-button").first()).toBeDisabled();
  await expect(
    page.getByText("La réservation et le paiement en ligne sont indisponibles"),
  ).toBeVisible();
});
test("aucune fausse confirmation avec URL de succès", async ({ page }) => {
  await page.goto(
    "/reservation/retour?success=true&token=00000000-0000-4000-8000-000000000001",
  );
  await expect(page.getByText("Aucune réservation vérifiable")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).not.toContainText(
    "réservé",
  );
});
test("admin protégé et formulaires non configurés", async ({
  page,
  request,
}) => {
  await page.goto("/admin/parametres");
  await expect(page).toHaveURL(/admin\/connexion/);
  await expect(
    page.getByRole("button", { name: "Se connecter" }),
  ).toBeDisabled();
  await page.goto("/contact");
  await expect(
    page.getByRole("button", { name: "Envoyer ma demande" }),
  ).toBeDisabled();
  const r = await request.post("/api/admin/mutate", {
    headers: { origin: "http://127.0.0.1:3211" },
    data: { action: "block", data: {} },
  });
  expect(r.status()).toBe(401);
});
test("pages légales, cadeaux, 404 et aucune largeur excédentaire", async ({
  page,
}) => {
  for (const url of [
    "/",
    "/prestations",
    "/cartes-cadeaux",
    "/contact",
    "/mentions-legales",
    "/confidentialite",
    "/reservation",
    "/page-inconnue",
  ]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await expect(
    page.getByRole("link", { name: "Revenir à l’accueil" }),
  ).toBeVisible();
});
test("API refuse une origine étrangère et un faux webhook", async ({
  request,
}) => {
  const booking = await request.post("/api/bookings", {
    headers: { origin: "https://evil.invalid" },
    data: {},
  });
  expect(booking.status()).toBe(403);
  const hook = await request.post("/api/webhooks/stripe", { data: "{}" });
  expect(hook.status()).toBe(400);
  const cron = await request.post("/api/cron");
  expect(cron.status()).toBe(401);
});
