import { test, expect } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { catalogue, eligible, type Service } from "../src/lib/catalogue";

const before = process.env.MONEA_CAPTURE_BEFORE === "1";
const phase = before ? "avant" : "apres";
const origin = "http://127.0.0.1:3210";
const temporaryCopy =
  /Photographies? d[’']illustration|Catalogue de lancement|Bientôt disponible|INTÉRIEUR D[’']AMBIANCE IMAGINÉ|BEAUTY MOODBOARD|CARTE CADEAU · APERÇU|Moodboard d[’']illustration|Les réservations ouvriront|Le studio se prépare|Instagram · à venir|TikTok · à venir/i;

test("catalogue complet, catégories, fiches et intégrité visuelle", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const folder = `docs/screenshots/nettoyage/${phase}/${info.project.name}`;
  await mkdir(folder, { recursive: true });
  const pages: Array<[string, string]> = [
    ["accueil", "/"],
    ["catalogue", "/prestations"],
    ["cadeaux", "/cartes-cadeaux"],
    ["contact", "/contact"],
    ["reservation", "/reservation"],
    ...catalogue.map((s): [string, string] => [
      s.slug,
      `/prestations/${s.slug}`,
    ]),
  ];
  for (const [name, url] of pages) {
    const response = await page.goto(url);
    expect(response?.status(), url).toBe(200);
    await page.evaluate(() => document.fonts.ready);
    if (!before) {
      await expect(page.locator("main")).not.toContainText(temporaryCopy);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        url,
      ).toBe(true);
    }
    await page.screenshot({
      path: `${folder}/${name}.png`,
      fullPage: true,
      animations: "disabled",
    });
    if (url === "/") {
      const identity = await page
        .locator(".site-header,.hero-mosaic,.care-photo-card,.brand-logo")
        .evaluateAll((nodes) =>
          nodes.map((node) => {
            const style = getComputedStyle(node);
            return {
              className: node.className,
              font: style.fontFamily,
              color: style.color,
              background: style.backgroundColor,
              padding: style.padding,
              gap: style.gap,
              images: [...node.querySelectorAll("img")].map((img) =>
                img.getAttribute("src"),
              ),
            };
          }),
        );
      if (before)
        await writeFile(
          `${folder}/design.json`,
          JSON.stringify(identity, null, 2),
        );
      else
        expect(identity).toEqual(
          JSON.parse(
            await readFile(
              `docs/screenshots/nettoyage/avant/${info.project.name}/design.json`,
              "utf8",
            ),
          ),
        );
      const links = await page
        .locator('main a[href^="/prestations/"]')
        .evaluateAll((nodes) => [
          ...new Set(nodes.map((n) => n.getAttribute("href")!)),
        ]);
      for (const href of links)
        expect((await page.request.get(href)).status(), href).toBe(200);
    }
    if (url === "/prestations") {
      await expect(page.locator(".service-card")).toHaveCount(catalogue.length);
      for (const category of new Set(catalogue.map((s) => s.category))) {
        await page.getByRole("button", { name: category, exact: true }).click();
        await expect(page.locator(".service-card")).toHaveCount(
          catalogue.filter((s) => s.category === category).length,
        );
      }
    }
    if (!before && url.startsWith("/prestations/")) {
      const service = catalogue.find((s) => url.endsWith(`/${s.slug}`))!;
      if (eligible(service)) {
        const link = page.getByRole("link", {
          name: "Voir les disponibilités",
        });
        await expect(link).toHaveAttribute(
          "href",
          `/reservation?service=${service.id}`,
        );
        await link.click();
        await expect(
          page.getByRole("combobox", { name: "Votre prestation", exact: true }),
        ).toHaveValue(service.id);
      } else {
        await expect(
          page.getByRole("link", { name: "Voir les disponibilités" }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("button", {
            name: "Réservation indisponible",
            exact: true,
          }),
        ).toBeDisabled();
      }
    }
  }
});

test("états administrateur, restrictions et réservation des cinq prestations actives", async ({
  page,
}, info) => {
  test.skip(before, "Capture initiale uniquement");
  test.setTimeout(120000);
  // Distinct visitors keep the real five-request anti-abuse limit unchanged.
  await page.setExtraHTTPHeaders({
    "x-real-ip":
      info.project.name === "local-mobile" ? "127.0.0.2" : "127.0.0.1",
  });
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
  const snapshot = await (await page.request.get("/api/admin/manage")).json();
  const services = snapshot.services as Service[];
  expect(services).toHaveLength(16);
  expect(services.filter(eligible)).toHaveLength(5);
  for (const s of services.filter((s) => !eligible(s))) {
    await page.goto(`/reservation?service=${s.id}`);
    await expect(page.locator("main")).toContainText(s.name);
    await expect(
      page.getByRole("combobox", { name: "Votre prestation", exact: true }),
    ).toHaveCount(0);
    const day = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const availability = await (
      await page.request.get(`/api/availability?service=${s.id}&date=${day}`)
    ).json();
    expect(availability.slots).toEqual([]);
  }
  await page.goto("/admin/catalogue");
  await expect(
    page.getByRole("heading", { name: "Catalogue", exact: true }),
  ).toBeVisible();
  for (const s of services)
    await expect(page.locator(".management-shell")).toContainText(s.name);
  await page.screenshot({
    path: `docs/screenshots/nettoyage/apres/${info.project.name}/admin-catalogue.png`,
    fullPage: true,
  });
  // Hours are test fixtures in a separate SQLite file; the working database is never opened here.
  const hours = await page.request.post("/api/admin/manage", {
    headers: { origin },
    data: {
      action: "hours_save",
      data: {
        hours: Array.from({ length: 7 }, (_, weekday) => ({
          weekday,
          opens: "09:00",
          closes: "18:00",
        })),
      },
    },
  });
  expect(hours.ok()).toBe(true);
  for (const s of services.filter(eligible)) {
    await page.goto(`/reservation?service=${s.id}`);
    await expect(
      page.getByRole("combobox", { name: "Votre prestation", exact: true }),
    ).toHaveValue(s.id);
    await expect(
      page.locator(".week-grid button:enabled").first(),
    ).toBeVisible();
    await page.locator(".week-grid button:enabled").first().click();
    await page.locator(".slots button:enabled").first().click();
    await page.getByLabel("Prénom", { exact: true }).fill("Contrôle");
    await page.getByLabel("Nom", { exact: true }).fill("Catalogue");
    await page
      .getByLabel("Email", { exact: true })
      .fill("catalogue@example.invalid");
    await page.getByLabel("Téléphone", { exact: true }).fill("0612345678");
    await page.locator("input[name=consent]").check();
    await page
      .getByRole("button", { name: "Continuer vers le paiement fictif" })
      .click();
    await expect(page).toHaveURL(/paiement-local\?token=/);
    await page.getByRole("button", { name: /Simuler.*réussi/i }).click();
    await expect(page).toHaveURL(/reservation\/retour/);
    await expect(
      page.getByText("Paiement fictif accepté. Rendez-vous confirmé."),
    ).toBeVisible();
  }
  const after = await (await page.request.get("/api/admin/manage")).json();
  expect(after.services).toEqual(services);
});
