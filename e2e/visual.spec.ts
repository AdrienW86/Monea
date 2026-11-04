import { test, expect } from "@playwright/test";
const pages = [
  ["accueil", "/"],
  ["prestations", "/prestations"],
  ["fiche-regard", "/prestations/extensions-cils"],
  ["reservation", "/reservation"],
  ["contact", "/contact"],
  ["cartes-cadeaux", "/cartes-cadeaux"],
  ["connexion", "/admin/connexion"],
];
test("recette photographique de toutes les pages principales", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const [name, url] of pages) {
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(async () => {
      for (
        let y = 0;
        y < document.documentElement.scrollHeight;
        y += window.innerHeight * 0.8
      ) {
        window.scrollTo({ top: y, behavior: "instant" });
        await new Promise((resolve) => setTimeout(resolve, 65));
      }
      window.scrollTo({ top: 0, behavior: "instant" });
    });
    await page.waitForFunction(() =>
      Array.from(document.images)
        .filter((img) => img.getClientRects().length > 0)
        .every((img) => img.complete && img.naturalWidth > 0),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      url,
    ).toBe(true);
    await page.screenshot({
      path: `docs/screenshots/refonte/${testInfo.project.name}/${name}.png`,
      fullPage: true,
      animations: "disabled",
    });
    if (name === "accueil") {
      await page.screenshot({
        path: `docs/screenshots/refonte/${testInfo.project.name}/accueil-premier-ecran.png`,
        animations: "disabled",
      });
      await page.addStyleTag({
        content: ".site-header {position:relative !important}",
      });
      for (const [section, selector] of [
        ["hero", ".hero-mosaic-section"],
        ["soins", ".care-section"],
        ["cadeaux", ".beauty-gifts"],
      ] as const) {
        await page.locator(selector).screenshot({
          path: `docs/screenshots/refonte/${testInfo.project.name}/detail-${section}.png`,
          animations: "disabled",
        });
      }
    }
    if (url === "/") {
      await expect(page.locator(".care-photo-card")).toHaveCount(7);
      await expect(page.locator(".spa-hero-image img")).toHaveCount(1);
      const heroSources = await page
        .locator(".spa-hero-image img")
        .evaluateAll((images) =>
          images.map((image) =>
            new URL(
              image.getAttribute("src")!,
              location.origin,
            ).searchParams.get("url"),
          ),
        );
      const catalogueSources = await page
        .locator(".care-photo-card img")
        .evaluateAll((images) =>
          images.map((image) =>
            new URL(
              image.getAttribute("src")!,
              location.origin,
            ).searchParams.get("url"),
          ),
        );
      expect(
        heroSources.every(
          (source) => source && !catalogueSources.includes(source),
        ),
      ).toBe(true);
      const booking = page.getByRole("link", {
        name: "Réserver mon rendez-vous",
        exact: true,
      });
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
      await expect(booking).toBeVisible();
      const bookingBox = (await booking.boundingBox())!;
      expect(bookingBox.height).toBeGreaterThanOrEqual(48);
      expect(bookingBox.y).toBeGreaterThan(0);
      expect(bookingBox.y + bookingBox.height).toBeLessThan(
        page.viewportSize()!.height,
      );
      await expect(page.locator(".spa-hero-image img")).toHaveAttribute(
        "src",
        /rituel-naturel/,
      );
      expect(
        await page
          .locator("img")
          .evaluateAll((images) =>
            images.some((img) =>
              img.getAttribute("src")?.includes("reference-flyer"),
            ),
          ),
      ).toBe(false);
    }
  }
  expect(errors).toEqual([]);
});
test("réduction des animations et navigation tactile", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const waiting = page.locator('.reveal[data-reveal="waiting"]');
  await expect(waiting).toHaveCount(0);
  if ((page.viewportSize()?.width || 0) <= 700) {
    await page.getByLabel("Ouvrir la navigation").click();
    await page
      .getByRole("navigation", { name: "Navigation mobile" })
      .getByRole("link", { name: "Les prestations" })
      .click();
    await expect(page).toHaveURL(/prestations/);
    await expect(page.locator(".mobile-menu")).not.toHaveAttribute("open", "");
  }
});
