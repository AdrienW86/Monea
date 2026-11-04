import { test, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
import { catalogue, eligible } from "../src/lib/catalogue";
import { categoryLabel } from "../src/lib/service-presentation";

test("univers spa, accessibilité et intégrité de l’administration", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const phase = process.env.MONEA_CAPTURE_BEFORE === "1" ? "avant" : "apres";
  const suite = process.env.MONEA_CAPTURE_SUITE || "spa";
  const folder = `docs/screenshots/${suite}/${phase}/${info.project.name}`;
  const selectedRoutes = process.env.MONEA_CAPTURE_ROUTES?.split(",");
  await mkdir(folder, { recursive: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const login = await page.request.post("/api/admin/login", {
    headers: { origin: "http://127.0.0.1:3212" },
    data: {
      email: "e2e@example.invalid",
      password: process.env.MONEA_E2E_PASSWORD,
    },
  });
  expect(login.ok()).toBe(true);
  if (process.env.MONEA_CAPTURE_PRICED === "1")
    execFileSync(
      process.execPath,
      ["scripts/activate-local-priced-services.mjs"],
      {
        env: {
          ...process.env,
          DATA_PROVIDER: "local",
          LOCAL_DATABASE_PATH: process.env.MONEA_E2E_DB,
        },
        stdio: "pipe",
      },
    );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const [name, route] of [
    ["accueil", "/"],
    ["catalogue", "/prestations"],
    ["prestation", "/prestations/extensions-cils"],
    ["prestation-reglementee", "/prestations/soin-visage"],
    ["equipement-etude", "/prestations/uv"],
    ["reservation", "/reservation"],
    ["cadeaux", "/cartes-cadeaux"],
    ["contact", "/contact"],
    ["mentions-legales", "/mentions-legales"],
    ["confidentialite", "/confidentialite"],
    ["administration", "/admin"],
    ["admin-catalogue", "/admin/catalogue"],
    ["admin-planning", "/admin/planning"],
  ]) {
    if (selectedRoutes && !selectedRoutes.includes(route)) continue;
    expect((await page.goto(route))?.status()).toBe(200);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(async () => {
      for (
        let y = 0;
        y < document.documentElement.scrollHeight;
        y += innerHeight * 0.8
      ) {
        window.scrollTo({ top: y, behavior: "instant" });
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
      window.scrollTo({ top: 0, behavior: "instant" });
    });
    await page.waitForFunction(() =>
      [...document.images]
        .filter((img) => img.getClientRects().length)
        .every((img) => img.complete && img.naturalWidth),
    );
    if (route === "/prestations") {
      await expect(
        page.locator(".service-card .badge,.service-restriction"),
      ).toHaveCount(0);
      await expect(page.locator("main")).not.toContainText(
        /en cours de vérification|à valider|à l’étude|qualification/i,
      );
      for (const img of await page.locator(".service-card img").all())
        expect(await img.getAttribute("src")).toContain("spa-");
      const photos = await page
        .locator(".service-card img")
        .evaluateAll((imgs) => imgs.map((img) => img.getAttribute("src")));
      expect(
        new Set(photos).size,
        "Une photo distincte pour chaque prestation",
      ).toBe(catalogue.length);
    }
    const geometry = await page
      .locator("body *:not(nextjs-portal):not(script):not(style):not(link)")
      .evaluateAll((nodes) =>
        nodes
          .filter((n) => n.getClientRects().length)
          .map((n) => {
            const r = n.getBoundingClientRect();
            return {
              tag: n.tagName,
              class: n.getAttribute("class"),
              box: [r.x, r.y, r.width, r.height].map(
                (v) => Math.round(v * 10) / 10,
              ),
            };
          }),
      );
    await writeFile(
      `${folder}/${name}.json`,
      JSON.stringify(geometry, null, 2),
    );
    if (phase === "apres") {
      if (
        route.startsWith("/admin") &&
        route !== "/admin/catalogue" &&
        process.env.MONEA_CAPTURE_PRICED !== "1"
      )
        expect(geometry, `${route}: ergonomie admin identique`).toEqual(
          JSON.parse(
            await readFile(
              `docs/screenshots/spa/avant/${info.project.name}/${name}.json`,
              "utf8",
            ),
          ),
        );
      const a11y = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      await writeFile(
        `${folder}/${name}-contrastes.json`,
        JSON.stringify(a11y.violations, null, 2),
      );
      expect
        .soft(
          a11y.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => ({
              target: n.target,
              summary: n.failureSummary,
            })),
          })),
          `${route}: accessibilité AA`,
        )
        .toEqual([]);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      route,
    ).toBe(true);
    await page.screenshot({
      path: `${folder}/${name}.png`,
      fullPage: true,
      animations: "disabled",
      style: "nextjs-portal { visibility: hidden; }",
    });
    const sectionStyle = "nextjs-portal, .site-header { visibility: hidden; }";
    if (route === "/" || route === "/cartes-cadeaux") {
      await expect(page.locator(".validated-gift-image")).toHaveAttribute(
        "src",
        "/branding/supports/carte-cadeau-bois-validee.jpg",
      );
      await expect(
        page.locator(".beauty-gift-card,.gift-envelope,.gift-ribbon"),
      ).toHaveCount(0);
      const visual = route === "/" ? ".spa-gift-wrap" : ".gift-page-body";
      await page.locator(visual).screenshot({
        path: `${folder}/${name}-section-cadeaux.png`,
        animations: "disabled",
        style: sectionStyle,
      });
      if (route === "/")
        await page.locator(".spa-hero").screenshot({
          path: `${folder}/hero.png`,
          animations: "disabled",
          style: sectionStyle,
        });
    }
    if (route === "/contact") {
      for (const side of ["recto", "verso"])
        await expect(
          page.locator(
            `.validated-business-image[src$="carte-visite-${side}.png"]`,
          ),
        ).toBeVisible();
      await page.locator(".printed-supports").screenshot({
        path: `${folder}/supports-imprimes.png`,
        animations: "disabled",
        style: sectionStyle,
      });
    }
    for (const image of await page
      .locator(".validated-gift-image,.validated-business-image")
      .all()) {
      expect(
        await image.evaluate((img) => {
          const style = getComputedStyle(img);
          const rect = img.getBoundingClientRect();
          const original = img as HTMLImageElement;
          return (
            style.objectFit === "contain" &&
            style.filter === "none" &&
            Math.abs(
              rect.width / rect.height -
                original.naturalWidth / original.naturalHeight,
            ) < 0.01
          );
        }),
      ).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});

test("catalogue, restrictions et navigation vers la réservation", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const booking = page.getByRole("link", {
    name: "Réserver mon rendez-vous",
    exact: true,
  });
  const box = (await booking.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.y + box.height).toBeLessThan(page.viewportSize()!.height);
  if (page.viewportSize()!.width <= 700) {
    await page.getByLabel("Ouvrir la navigation").click();
    await page
      .getByRole("navigation", { name: "Navigation mobile" })
      .getByRole("link", { name: "Les prestations" })
      .click();
    await expect(page).toHaveURL(/prestations/);
  } else
    await page
      .getByRole("link", { name: "Tout le catalogue", exact: true })
      .click();
  await expect(page.locator(".service-card")).toHaveCount(catalogue.length);
  for (const category of new Set(catalogue.map((s) => s.category))) {
    await page
      .getByRole("button", { name: categoryLabel(category), exact: true })
      .click();
    await expect(page.locator(".service-card")).toHaveCount(
      catalogue.filter((s) => s.category === category).length,
    );
  }
  for (const service of catalogue) {
    await page.goto(`/prestations/${service.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      service.name,
    );
    if (eligible(service)) {
      await expect(
        page.getByRole("link", { name: "Voir les disponibilités" }),
      ).toHaveAttribute("href", `/reservation?service=${service.id}`);
    } else {
      await expect(
        page.getByRole("link", { name: "Nous contacter", exact: true }),
      ).toHaveAttribute("href", "/contact");
      await expect(
        page.getByRole("link", { name: "Voir les disponibilités" }),
      ).toHaveCount(0);
      await page.goto(`/reservation?service=${service.id}`);
      await expect(page.locator("main")).toContainText(service.name);
      await expect(page.locator(".week-grid")).toHaveCount(0);
    }
  }
});
