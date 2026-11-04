import { test, expect } from "@playwright/test";
const origin = "http://127.0.0.1:3213";
test("authentification et administration commune avec PostgreSQL réel", async ({
  page,
}, info) => {
  expect((await page.request.get("/api/admin/manage")).status()).toBe(401);
  await page.goto("/admin/planning");
  await expect(page).toHaveURL(/connexion/);
  const login = await page.request.post("/api/admin/login", {
    headers: {
      origin,
      "x-real-ip":
        info.project.name === "postgres-mobile" ? "127.0.0.2" : "127.0.0.1",
    },
    data: {
      email: "e2e@example.invalid",
      password: process.env.MONEA_E2E_PASSWORD,
    },
  });
  expect(login.ok(), await login.text()).toBe(true);
  const snapshot = await (await page.request.get("/api/admin/manage")).json();
  expect(snapshot.provider).toBe("supabase");
  expect(snapshot.services).toHaveLength(16);
  for (const section of [
    "",
    "planning",
    "rendez-vous",
    "clientes",
    "catalogue",
    "categories",
    "horaires",
    "indisponibilites",
    "notifications",
    "messages",
    "parametres",
  ]) {
    await page.goto(`/admin/${section}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".local-mode-pill")).toHaveText("Supabase");
    if (section === "parametres") {
      await page
        .getByText("Informations légales et ouverture des réservations", {
          exact: true,
        })
        .click();
      await expect(
        page.getByLabel("Raison sociale", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByLabel("Réservations publiques activées", { exact: true }),
      ).toBeChecked();
    }
    if (section === "notifications")
      await expect(
        page.getByRole("button", {
          name: "Traiter la file d’envoi",
          exact: true,
        }),
      ).toBeVisible();
  }
  const service = snapshot.services.find(
    (s: { qualification_requirement: string }) =>
      s.qualification_requirement === "none",
  );
  const start = new Date();
  start.setUTCDate(
    start.getUTCDate() + (info.project.name === "postgres-mobile" ? 5 : 3),
  );
  start.setUTCHours(10, 0, 0, 0);
  const body = {
    action: "booking_save",
    data: {
      service_ids: [service.id],
      start_at: start.toISOString(),
      request_id: crypto.randomUUID(),
      client: {
        first_name: "Test",
        last_name: "PostgreSQL",
        email: "postgres@example.invalid",
        phone: "+33612345678",
      },
      offline_status: "unpaid",
      status: "confirmed",
    },
  };
  const saved = await page.request.post("/api/admin/manage", {
    headers: { origin },
    data: body,
  });
  expect(saved.ok(), await saved.text()).toBe(true);
  const id = (await saved.json()).result.id;
  expect(
    (
      await page.request.post("/api/admin/manage", {
        headers: { origin },
        data: {
          ...body,
          data: { ...body.data, request_id: crypto.randomUUID() },
        },
      })
    ).status(),
  ).toBe(409);
  await page.goto(`/admin/rendez-vous?id=${id}`);
  await expect(
    page.getByRole("heading", { name: "Fiche du rendez-vous" }),
  ).toBeVisible();
  await expect(page.getByText("Test PostgreSQL").first()).toBeVisible();
  await page.screenshot({
    path: `docs/screenshots/supabase/${info.project.name}-rendez-vous.png`,
    fullPage: true,
  });
  const catalogue = await (
    await page.request.get("/api/admin/manage?section=catalogue")
  ).json();
  expect(catalogue.clients).toEqual([]);
  expect(catalogue.bookings).toEqual([]);
  await page.goto("/prestations");
  await expect(page.locator(".service-card")).toHaveCount(16);
  expect(
    (
      await page.request.post("/api/admin/manage", {
        headers: { origin: "https://foreign.invalid" },
        data: body,
      })
    ).status(),
  ).toBe(403);
  const cancelled = await page.request.post("/api/admin/manage", {
    headers: { origin },
    data: {
      action: "booking_cancel",
      data: { id, reason: "Test", confirmed: true },
    },
  });
  expect(cancelled.ok()).toBe(true);
});
