import { test, expect } from "@playwright/test";

test("monogramme, texte MONÉA, icônes et captures après intégration", async ({
  page,
  request,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const folder = `docs/screenshots/monogramme/apres/${info.project.name}`;
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".wordmark")).toBeVisible();
  await expect(page.locator(".wordmark .brand-name")).toHaveText("MONÉA");
  await expect(page.locator(".wordmark img")).toHaveAttribute("alt", "");
  const symbol = page.locator(".wordmark img");
  await expect
    .poll(() =>
      symbol.evaluate(
        (img) =>
          (img as HTMLImageElement).complete &&
          (img as HTMLImageElement).naturalWidth > 0,
      ),
    )
    .toBe(true);
  expect(
    await symbol.evaluate((img) => {
      const r = img.getBoundingClientRect();
      return r.width === r.height && r.width >= 26 && r.width <= 40;
    }),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const iconLinks = await page
    .locator('link[rel="icon"],link[rel="apple-touch-icon"]')
    .evaluateAll((links) => links.map((el) => el.getAttribute("href")!));
  expect(iconLinks.filter((url) => url.includes("favicon.ico"))).toHaveLength(
    1,
  );
  expect(iconLinks.some((url) => url.includes("icon.png"))).toBe(true);
  expect(iconLinks.some((url) => url.includes("apple-icon.png"))).toBe(true);
  expect(iconLinks.some((url) => url.includes(".svg"))).toBe(false);
  for (const url of iconLinks) expect((await request.get(url)).ok()).toBe(true);
  await page.screenshot({ path: `${folder}/accueil.png` });
  await page
    .locator(".site-header")
    .screenshot({ path: `${folder}/header.png` });
  if (info.project.name === "local-mobile") {
    await page.getByLabel("Ouvrir la navigation").click();
    await page.screenshot({ path: `${folder}/menu-mobile.png` });
    await page.getByLabel("Ouvrir la navigation").click();
  }
  await page.locator(".beauty-footer").scrollIntoViewIfNeeded();
  await page
    .locator(".beauty-footer")
    .screenshot({ path: `${folder}/footer.png` });
  await page.goto("/admin/connexion");
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: "Se connecter" }).waitFor();
  await expect(page.locator(".login > .brand-logo .brand-name")).toHaveText(
    "MONÉA",
  );
  await page.screenshot({ path: `${folder}/connexion.png`, fullPage: true });
  const response = await page.request.post("/api/admin/login", {
    headers: {
      origin: "http://127.0.0.1:3210",
      "x-real-ip":
        info.project.name === "local-mobile" ? "127.0.0.2" : "127.0.0.1",
    },
    data: {
      email: "e2e@example.invalid",
      password: process.env.MONEA_E2E_PASSWORD,
    },
  });
  expect(response.ok()).toBe(true);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Tableau de bord", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".management-topbar .brand-name")).toHaveText(
    "MONÉA",
  );
  if (info.project.name === "local-desktop") {
    const aligned = await page
      .locator(".management-brand .brand-logo")
      .evaluate((logo) => {
        const icon = logo.querySelector("img")!.getBoundingClientRect();
        const text = logo.querySelector(".brand-name")!.getBoundingClientRect();
        return (
          icon.right <= text.left &&
          Math.abs(icon.y + icon.height / 2 - text.y - text.height / 2) < 2
        );
      });
    expect(aligned).toBe(true);
  }
  await page.screenshot({
    path: `${folder}/tableau-de-bord.png`,
    fullPage: true,
  });
  await page.goto("/");
  await page.evaluate(() => {
    const panel = document.createElement("div");
    panel.id = "monogram-icon-preview";
    panel.style.cssText =
      "position:relative;z-index:100;background:#fff8f2;color:#171311;padding:24px;display:flex;gap:24px;align-items:center";
    for (const background of ["#fff8f2", "#171311"]) {
      const row = document.createElement("div");
      row.style.cssText = `padding:24px;display:flex;align-items:center;gap:20px;background:${background}`;
      for (const size of [16, 32, 48]) {
        const img = document.createElement("img");
        img.src = `/branding/favicon-${size}.png`;
        img.width = size;
        img.height = size;
        row.append(img);
      }
      panel.append(row);
    }
    document.body.prepend(panel);
  });
  await page
    .locator("#monogram-icon-preview")
    .screenshot({ path: `${folder}/favicons-16-32-48.png` });
});
