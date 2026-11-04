import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  create: vi.fn(),
  retrieve: vi.fn(),
}));
vi.mock("@/lib/db/server", () => ({ db: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/db/queries", () => ({
  integrationStatus: () => ({ Stripe: true, Supabase: true }),
}));
vi.mock("@/lib/payments/stripe", () => ({
  stripeClient: () => ({
    checkout: { sessions: { create: mocks.create, retrieve: mocks.retrieve } },
  }),
}));
import { POST } from "@/app/api/bookings/route";
const input = {
  first_name: "Test",
  last_name: "Checkout",
  email: "test@example.invalid",
  phone: "0612345678",
  service_id: "00000000-0000-4000-8000-000000000001",
  start_at: "2027-01-01T10:00:00Z",
  request_id: "22222222-2222-4222-8222-222222222222",
  consent: true,
  website: "",
  price_cents: 1,
};
beforeEach(() => {
  vi.stubEnv("PAYMENT_PROVIDER", "stripe");
  vi.stubEnv("DATA_PROVIDER", "supabase");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3210");
  vi.stubEnv("RATE_LIMIT_SALT", "salt_fixture");
  mocks.create.mockReset();
  mocks.retrieve.mockReset();
  mocks.rpc.mockReset();
  mocks.create.mockResolvedValue({
    id: "cs_fixture",
    url: "https://checkout.stripe.com/fixture",
  });
  mocks.rpc.mockImplementation(async (name: string) =>
    name === "take_rate_limit"
      ? { data: true }
      : name === "create_booking"
        ? {
            data: {
              id: "booking",
              token: "opaque-token",
              price_cents: 2000,
              service_name: "Cils",
              checkout_minutes: 30,
            },
          }
        : { error: null },
  );
});
afterEach(() => vi.unstubAllEnvs());
const request = () =>
  new NextRequest("http://localhost:3210/api/bookings", {
    method: "POST",
    headers: {
      origin: "http://localhost:3210",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
it("utilise le prix serveur malgré un montant navigateur falsifié, sans appel Stripe réel", async () => {
  const result = await POST(request());
  expect(result.status).toBe(200);
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: 2000,
            product_data: { name: "Cils" },
          },
        },
      ],
    }),
    { idempotencyKey: input.request_id },
  );
  const bookingCall = mocks.rpc.mock.calls.find(
    (c) => c[0] === "create_booking",
  );
  expect(bookingCall?.[1].p_client.price_cents).toBeUndefined();
  expect(mocks.rpc).toHaveBeenCalledWith("attach_checkout", {
    p_booking: "booking",
    p_session: "cs_fixture",
  });
});
it("renvoie un conflit sans créer Checkout quand la base refuse le créneau", async () => {
  mocks.rpc.mockImplementation(async (name: string) =>
    name === "take_rate_limit" ? { data: true } : { error: { code: "23P01" } },
  );
  expect((await POST(request())).status).toBe(409);
  expect(mocks.create).not.toHaveBeenCalled();
});
it("ne confirme rien après une erreur ambiguë de création de Checkout", async () => {
  mocks.create.mockRejectedValue(new Error("timeout"));
  const result = await POST(request());
  expect(result.status).toBe(400);
  expect(await result.json()).not.toHaveProperty("paid");
  expect(
    mocks.rpc.mock.calls.some((c) => c[0] === "process_payment_event"),
  ).toBe(false);
});
it("reprend une session Checkout existante sans créer de deuxième session", async () => {
  mocks.rpc.mockImplementation(async (name: string) =>
    name === "take_rate_limit"
      ? { data: true }
      : {
          data: {
            id: "booking",
            token: "opaque-token",
            status: "pending",
            stripe_session_id: "cs_resume",
          },
        },
  );
  mocks.retrieve.mockResolvedValue({
    status: "open",
    url: "https://checkout.stripe.com/resume",
  });
  const result = await POST(request());
  expect(await result.json()).toEqual({
    url: "https://checkout.stripe.com/resume",
  });
  expect(mocks.retrieve).toHaveBeenCalledWith("cs_resume");
  expect(mocks.create).not.toHaveBeenCalled();
});
it("reprend une réservation terminée sur son statut sans appeler Stripe", async () => {
  mocks.rpc.mockImplementation(async (name: string) =>
    name === "take_rate_limit"
      ? { data: true }
      : { data: { id: "booking", token: "opaque-token", status: "confirmed" } },
  );
  expect(await (await POST(request())).json()).toEqual({
    url: "/reservation/retour?token=opaque-token",
  });
  expect(mocks.retrieve).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
});
it("réutilise l’échéance persistée dans les paramètres idempotents", async () => {
  const expiry = "2027-01-01T09:00:00Z";
  mocks.rpc.mockImplementation(async (name: string) =>
    name === "take_rate_limit"
      ? { data: true }
      : name === "create_booking"
        ? {
            data: {
              id: "booking",
              token: "opaque-token",
              price_cents: 2000,
              service_name: "Cils",
              checkout_expires_at: expiry,
              status: "pending",
            },
          }
        : { error: null },
  );
  expect((await POST(request())).status).toBe(200);
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({ expires_at: Date.parse(expiry) / 1000 }),
    { idempotencyKey: input.request_id },
  );
});
