import { test, expect } from "@playwright/test";
const origin = "http://127.0.0.1:3210";
test("identité, navigation, métadonnées et assets sur ordinateur et mobile", async ({
  page,
  request,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const [path, name] of [
    ["/", "accueil"],
    ["/prestations", "catalogue"],
    ["/reservation", "reservation"],
    ["/reservation/retour", "confirmation"],
    ["/contact", "contact"],
    ["/cartes-cadeaux", "cadeaux"],
    ["/admin/connexion", "connexion"],
  ]) {
    await page.goto(path);
    await page.locator(".wordmark .brand-logo").waitFor();
    const logos = page.locator(".brand-symbol-image:visible");
    for (const logo of await logos.all()) {
      await expect(logo).toHaveAttribute("alt", "");
      await expect
        .poll(() =>
          logo.evaluate((el) => {
            const img = el as HTMLImageElement;
            const r = img.getBoundingClientRect();
            const style = getComputedStyle(img);
            return (
              img.complete &&
              img.naturalWidth > 0 &&
              Math.abs(parseFloat(style.width) / parseFloat(style.height) - 1) <
                0.08 &&
              r.left >= 0 &&
              r.right <= innerWidth + 1
            );
          }),
        )
        .toBe(true);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator("body")).not.toContainText(
      /Beauty Studio|Le projet beauté de Monica|ESPACE MONICA/i,
    );
    await page.screenshot({
      path: `docs/screenshots/marque/${info.project.name}-${name}.png`,
      fullPage: true,
    });
  }
  await page.goto("/");
  await expect(page).toHaveTitle("MONÉA | Institut de beauté à Perpignan");
  expect(
    await page.locator('meta[name="description"]').getAttribute("content"),
  ).toContain("soins du visage");
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  const schema = JSON.parse(
    await page.locator('script[type="application/ld+json"]').innerHTML(),
  );
  expect(schema.name).toBe("MONÉA");
  expect(schema).not.toHaveProperty("geo");
  if (info.project.name === "local-mobile") {
    await page.getByLabel("Ouvrir la navigation").click();
    await expect(page.locator(".mobile-menu nav img")).toBeVisible();
    await page.screenshot({
      path: `docs/screenshots/marque/${info.project.name}-menu.png`,
    });
    await page
      .getByRole("navigation", { name: "Navigation mobile" })
      .getByRole("link", { name: "Les prestations", exact: true })
      .click();
    await expect(page).toHaveURL(/prestations/);
  }
  await page.locator(".wordmark").click();
  await expect(page).toHaveURL(`${origin}/`);
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.name).toBe("MONÉA");
  for (const path of [
    "/favicon.ico",
    "/apple-touch-icon.png",
    "/icon-192.png",
    "/icon-512.png",
    "/assets/brand/opengraph.png",
  ])
    expect((await request.get(path)).ok()).toBe(true);
  expect(errors).toEqual([]);
});

test("contacts administrables, sauvegardés et restitués publiquement", async ({
  page,
}, info) => {
  const login = await page.request.post("/api/admin/login", {
    headers: {
      origin,
      "x-real-ip":
        info.project.name === "local-mobile" ? "127.0.0.2" : "127.0.0.1",
    },
    data: {
      email: "e2e@example.invalid",
      password: process.env.MONEA_E2E_PASSWORD,
    },
  });
  expect(login.ok()).toBe(true);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Tableau de bord", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `docs/screenshots/marque/${info.project.name}-dashboard.png`,
    fullPage: true,
  });
  await page.goto("/admin/parametres");
  const email = page.getByLabel("E-mail professionnel", { exact: true });
  await email.fill("contact@example.invalid");
  const form = page.locator("form").filter({ has: email });
  const saved = page.waitForResponse(
    (res) =>
      res.url().endsWith("/api/admin/manage") &&
      res.request().method() === "POST",
  );
  await form.getByRole("button", { name: /Enregistrer/ }).click();
  expect((await saved).ok()).toBe(true);
  await page.reload();
  await expect(email).toHaveValue("contact@example.invalid");
  await page.goto("/contact");
  await expect(
    page.locator('footer a[href="mailto:contact@example.invalid"]'),
  ).toBeVisible();
  const snapshot = await (await page.request.get("/api/admin/manage")).json();
  const save = await page.request.post("/api/admin/manage", {
    headers: { origin },
    data: {
      action: "settings_save",
      data: { ...snapshot.settings, email: "" },
    },
  });
  expect(save.ok()).toBe(true);
});
