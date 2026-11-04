import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const origin = "http://127.0.0.1:3212";
test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => console.error("BROWSER ERROR:", e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.error("BROWSER CONSOLE:", m.text());
  });
});
async function login(page: Page) {
  const res = await page.request.post("/api/admin/login", {
    headers: {
      origin,
      "x-real-ip":
        test.info().project.name === "local-mobile" ? "127.0.0.2" : "127.0.0.1",
    },
    data: {
      email: "e2e@example.invalid",
      password: process.env.MONEA_E2E_PASSWORD,
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
}
async function snapshot(page: Page) {
  const r = await page.request.get("/api/admin/manage");
  expect(r.ok()).toBe(true);
  return r.json();
}
async function mutate(page: Page, action: string, data: unknown) {
  const r = await page.request.post("/api/admin/manage", {
    headers: { origin },
    data: { action, data },
  });
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}
test("visiteur refusé, session HttpOnly, CSRF et déconnexion", async ({
  page,
}) => {
  await page.goto("/admin/planning");
  await expect(page).toHaveURL(/admin\/connexion/);
  expect((await page.request.get("/api/admin/manage")).status()).toBe(401);
  await login(page);
  const cookie = (await page.context().cookies()).find(
    (c) => c.name === "monea_local_session",
  );
  expect(cookie?.httpOnly).toBe(true);
  expect(
    (
      await page.request.post("/api/admin/manage", {
        headers: { origin: "https://untrusted.invalid" },
        data: { action: "demo_load", data: { confirmed: true } },
      })
    ).status(),
  ).toBe(403);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Tableau de bord", exact: true }),
  ).toBeVisible();
  expect(
    (
      await page.request.post("/api/admin/logout", { headers: { origin } })
    ).ok(),
  ).toBe(true);
  expect((await page.request.get("/api/admin/manage")).status()).toBe(401);
});
test("rendez-vous manuel depuis le formulaire, conflit et annulation", async ({
  page,
}, info) => {
  await login(page);
  await mutate(page, "demo_load", { confirmed: true });
  const data = await snapshot(page);
  const s = data.services.find(
    (v: { qualification_requirement: string; bookable: boolean }) =>
      v.qualification_requirement === "none" && v.bookable,
  );
  let slot: { start_at: string; end_at: string } | undefined;
  let day = "";
  for (let n = 4; n < 10; n++) {
    day = new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    const response = await page.request.get(
      `/api/availability?service=${s.id}&date=${day}`,
    );
    const body = await response.json();
    slot = body.slots.find((v: { available: boolean }) => v.available);
    if (slot) break;
  }
  expect(slot).toBeTruthy();
  await page.goto("/admin/rendez-vous");
  await page
    .getByRole("button", { name: "Nouveau rendez-vous", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("select").first().selectOption(data.clients[0].id);
  await dialog.locator(`input[type=checkbox][value="${s.id}"]`).check();
  const paris = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date(slot!.start_at))
    .replace(" ", "T");
  await dialog.locator("input[name=start_at]").fill(paris);
  await dialog
    .locator("select[name=offline_status]")
    .selectOption("paid_offline");
  await dialog
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const current = await snapshot(page);
  const b = current.bookings.find(
    (v: { allocation: { start_at: string }; status: string }) =>
      v.allocation.start_at === slot!.start_at && v.status === "confirmed",
  );
  expect(b.offline_status).toBe("paid_offline");
  const payload = {
    service_ids: [s.id],
    client_id: b.client_id,
    start_at: slot!.start_at,
    request_id: crypto.randomUUID(),
  };
  const clash = await page.request.post("/api/admin/manage", {
    headers: { origin },
    data: { action: "booking_save", data: payload },
  });
  expect(clash.status()).toBe(409);
  await page.goto("/admin/rendez-vous?id=" + b.id);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({
    path: `test-results/${info.project.name}-booking.png`,
    fullPage: true,
    caret: "initial",
  });
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Annuler ce rendez-vous", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const publicSlots = await page.request.get(
    `/api/availability?service=${s.id}&date=${day}`,
  );
  expect(
    (await publicSlots.json()).slots.find(
      (v: { start_at: string }) => v.start_at === slot!.start_at,
    ).available,
  ).toBe(true);
});
test("catégorie et prestation : formulaires et persistance après actualisation", async ({
  page,
}, info) => {
  await login(page);
  await page.goto("/admin/categories");
  await page
    .getByRole("button", { name: "Nouvelle catégorie", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const name = "Catégorie " + info.project.name;
  await dialog.getByLabel("Nom de la catégorie").fill(name);
  await dialog
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();
  await page.goto("/admin/catalogue");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const serviceDialog = page.getByRole("dialog");
  const serviceName = "Conseils fictifs " + info.project.name;
  await serviceDialog
    .getByLabel("Nom de la prestation", { exact: true })
    .fill(serviceName);
  await serviceDialog
    .getByLabel("Catégorie", { exact: true })
    .selectOption({ label: name });
  await serviceDialog
    .getByLabel("Description", { exact: true })
    .fill("Une prestation de soin personnalisée.");
  await serviceDialog.getByLabel("Prix TTC en euros").fill("25");
  await expect(
    serviceDialog.getByLabel("Exigence de qualification"),
  ).toHaveCount(0);
  await expect(serviceDialog.locator("input,select,textarea")).toHaveCount(4);
  await serviceDialog
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click();
  await expect(serviceDialog).not.toBeVisible();
  await page
    .getByRole("row")
    .filter({ hasText: serviceName })
    .getByRole("button", { name: "Modifier", exact: true })
    .click();
  await serviceDialog.getByLabel("Prix TTC en euros").fill("32");
  await serviceDialog
    .getByLabel("Description", { exact: true })
    .fill("Le descriptif modifié depuis l’espace privé.");
  await serviceDialog
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click();
  await expect(serviceDialog).not.toBeVisible();
  expect(
    (await snapshot(page)).services.find(
      (s: { name: string }) => s.name === serviceName,
    ),
  ).toMatchObject({
    price_cents: 3200,
    duration_minutes: 60,
    description: "Le descriptif modifié depuis l’espace privé.",
    bookable: true,
    operational_status: "active",
  });
  const updated = (await snapshot(page)).services.find(
    (s: { name: string }) => s.name === serviceName,
  );
  await page.goto(`/prestations/${updated.slug}`);
  await expect(page.locator("main")).toContainText(
    "Le descriptif modifié depuis l’espace privé.",
  );
  await expect(page.locator("main")).toContainText("32,00");
  await page.goto("/admin/catalogue");
  await page
    .getByRole("row")
    .filter({ hasText: serviceName })
    .getByRole("button", { name: "Modifier", exact: true })
    .click();
  await page.screenshot({
    path: `test-results/${info.project.name}-catalogue-form.png`,
    fullPage: true,
    caret: "initial",
  });
  await serviceDialog
    .getByRole("button", { name: "Enregistrer", exact: true })
    .hover();
  expect(
    (
      await new AxeBuilder({ page })
        .include(".management-dialog")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Fermer la fenêtre" }).click();
});
test("planning jour semaine mois, navigation mobile et inspection des onze rubriques", async ({
  page,
}, info) => {
  await login(page);
  await mutate(page, "demo_load", { confirmed: true });
  await page.goto("/admin/planning");
  await expect(page.locator(".time-day-lane")).toHaveCount(7);
  await expect(page.locator(".calendar-event").first()).toBeVisible();
  await page.screenshot({
    path: `test-results/${info.project.name}-planning-week.png`,
    fullPage: true,
    caret: "initial",
  });
  await page.getByRole("button", { name: "Journée", exact: true }).click();
  await expect(page.locator(".time-day-lane")).toHaveCount(1);
  await page.getByRole("button", { name: "Mois", exact: true }).click();
  await expect(page.locator(".month-day")).toHaveCount(42);
  await page.screenshot({
    path: `test-results/${info.project.name}-planning-month.png`,
    fullPage: true,
    caret: "initial",
  });
  await page.locator(".month-day").nth(10).click();
  await expect(page.locator(".time-day-lane")).toHaveCount(1);
  for (const section of [
    "rendez-vous",
    "clientes",
    "indisponibilites",
    "horaires",
    "catalogue",
    "categories",
    "notifications",
    "messages",
    "parametres",
  ]) {
    await page.goto("/admin/" + section);
    await expect(page.locator(".management-shell")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  if (info.project.name.includes("mobile")) {
    await page
      .getByRole("button", { name: "Navigation administratrice" })
      .click();
    await expect(page.locator(".management-sidebar")).toHaveClass(/is-open/);
    await page.getByRole("link", { name: "Planning", exact: true }).click();
    await expect(page).toHaveURL(/planning/);
  }
  await page.goto("/admin/horaires");
  await page.screenshot({
    path: `test-results/${info.project.name}-hours.png`,
    fullPage: true,
    caret: "initial",
  });
});
test("réservation publique complète, succès fictif, confidentialité et notifications", async ({
  page,
}, info) => {
  await login(page);
  await mutate(page, "demo_load", { confirmed: true });
  await page.goto("/reservation");
  const services = await snapshot(page);
  const first = services.services.find(
    (s: {
      qualification_requirement: string;
      bookable: boolean;
      operational_status: string;
    }) =>
      s.qualification_requirement === "none" &&
      s.bookable &&
      s.operational_status === "active",
  );
  await page.getByLabel("Votre catégorie").selectOption(first.category);
  await page.getByLabel("Votre prestation").selectOption(first.id);
  let selected = false;
  for (let i = 0; i < 3; i++) {
    await expect(page.locator(".week-grid button")).toHaveCount(7);
    const date = page.locator(".week-grid button:enabled").first();
    if (await date.count()) {
      await date.click();
      selected = true;
      break;
    }
    await page
      .getByRole("button", { name: "Semaine suivante", exact: true })
      .click();
    await page.waitForTimeout(400);
  }
  expect(selected).toBe(true);
  await page.locator(".slots button:enabled").first().click();
  await page.getByLabel("Prénom", { exact: true }).fill("Visiteuse fictive");
  await page.getByLabel("Nom", { exact: true }).fill("Secret");
  await page
    .getByLabel("Email", { exact: true })
    .fill("visiteuse@example.invalid");
  await page.getByLabel("Téléphone", { exact: true }).fill("0612345678");
  await page.locator("input[name=consent]").check();
  await page
    .getByRole("button", { name: "Continuer vers le paiement fictif" })
    .click();
  await expect(page).toHaveURL(/paiement-local\?token=/);
  await expect(page.getByText(/aucun débit/i).first()).toBeVisible();
  await page.screenshot({
    path: `test-results/${info.project.name}-mock-checkout.png`,
    fullPage: true,
    caret: "initial",
  });
  await page.getByRole("button", { name: /Simuler.*réussi/i }).click();
  await expect(page).toHaveURL(/reservation\/retour/);
  await expect(page.getByText(/confirmé/i).first()).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain(
    "visiteuse@example.invalid",
  );
  const data = await snapshot(page);
  expect(
    data.bookings.some(
      (b: { payment?: { status: string } }) =>
        b.payment?.status === "mock_paid",
    ),
  ).toBe(true);
  expect(
    data.notifications.some((n: { kind: string }) =>
      n.kind.includes("payment"),
    ),
  ).toBe(true);
});
