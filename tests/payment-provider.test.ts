import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import Stripe from "stripe";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  snapshot: vi.fn(),
  mutate: vi.fn(),
  simulate: vi.fn(),
}));
vi.mock("@/lib/db/server", () => ({
  db: () => ({ rpc: mocks.rpc }),
  dbConfigured: () => true,
  requireAdmin: async () => ({
    user: { id: "11111111-1111-4111-8111-111111111111" },
  }),
}));
vi.mock("@/lib/auth/management", () => ({
  requireManagementAdmin: async () => ({
    id: "11111111-1111-4111-8111-111111111111",
  }),
}));
vi.mock("@/lib/data/repository", () => ({
  repository: () => ({ snapshot: mocks.snapshot, mutate: mocks.mutate }),
}));
vi.mock("@/lib/data/local", () => ({
  localRepository: () => ({ simulatePayment: mocks.simulate }),
}));
import { stripeClient } from "@/lib/payments/stripe";
import {
  paymentProvider,
  stripePaymentsEnabled,
} from "@/lib/payments/provider.mjs";
import { integrationStatus } from "@/lib/db/queries";
import { POST as booking } from "@/app/api/bookings/route";
import { POST as webhook } from "@/app/api/webhooks/stripe/route";
import { POST as admin } from "@/app/api/admin/mutate/route";
import { GET as snapshot, POST as manage } from "@/app/api/admin/manage/route";
import { POST as mockPayment } from "@/app/api/payments/mock/route";
const origin = "http://localhost:3210";
const id = "22222222-2222-4222-8222-222222222222";
const network = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DATA_PROVIDER", "supabase");
  vi.stubEnv("PAYMENT_PROVIDER", "mock");
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("STRIPE_API_KEY", "sk_test_fixture");
  vi.stubEnv("STRIPE_SECRET_KEY", "");
  vi.stubEnv("STRIPE_PUBLISHABLE_KEY", "pk_test_fixture");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_fixture");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", origin);
  vi.stubEnv("RATE_LIMIT_SALT", "fixture");
  vi.stubGlobal("fetch", network);
  network.mockImplementation(() => {
    throw Error("Unexpected network request");
  });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.snapshot.mockResolvedValue({ provider: "supabase", bookings: [] });
  mocks.mutate.mockResolvedValue({ ok: true });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const post = (path: string, body: unknown) =>
  new NextRequest(origin + path, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
it.each(["local", "supabase"])(
  "%s/mock refuses constructing Stripe despite configured test keys",
  (data) => {
    vi.stubEnv("DATA_PROVIDER", data);
    expect(() => stripeClient()).toThrow(/désactivée/);
    expect(integrationStatus().Stripe).toBe(false);
    expect(network).not.toHaveBeenCalled();
  },
);
it.each(["", "MOCK", "unknown"])(
  "fails closed for invalid/missing provider %s",
  (provider) => {
    vi.stubEnv("PAYMENT_PROVIDER", provider);
    expect(paymentProvider()).toBe("disabled");
    expect(stripePaymentsEnabled()).toBe(false);
    expect(() => stripeClient()).toThrow();
    expect(network).not.toHaveBeenCalled();
  },
);
it("supabase/mock blocks new Checkout and session recovery before any database call", async () => {
  for (const body of [
    {},
    { stripe_session_id: "cs_test_old", request_id: id },
  ]) {
    const response = await booking(post("/api/bookings", body));
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("PAYMENT_PROVIDER_DISABLED");
  }
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(network).not.toHaveBeenCalled();
});
it("supabase/mock blocks refunds before prepare_refund or rate-limit mutation", async () => {
  const response = await admin(
    post("/api/admin/mutate", {
      action: "refund",
      data: { id, confirmed: true },
    }),
  );
  expect(response.status).toBe(503);
  expect((await response.json()).code).toBe("PAYMENT_PROVIDER_DISABLED");
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(network).not.toHaveBeenCalled();
});
it.each([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "charge.refunded",
])(
  "supabase/mock rejects valid signed %s without financial processing",
  async (type) => {
    const payload = JSON.stringify({
      id: "evt_fixture",
      type,
      livemode: false,
      data: {
        object: {
          id: "cs_test_fixture",
          amount_total: 2000,
          currency: "eur",
          payment_status: "paid",
        },
      },
    });
    const req = new NextRequest(origin + "/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: {
        "stripe-signature": Stripe.webhooks.generateTestHeaderString({
          payload,
          secret: "whsec_fixture",
        }),
      },
    });
    expect((await webhook(req)).status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
  },
);
it("supabase/mock preserves administrative reads and nonfinancial commands", async () => {
  const response = await snapshot(
    new NextRequest(origin + "/api/admin/manage?section=lookup"),
  );
  expect(response.status).toBe(200);
  expect(mocks.snapshot).toHaveBeenCalled();
  expect(
    (
      await manage(
        post("/api/admin/manage", {
          action: "booking_cancel",
          data: { id, reason: "Recette isolée", confirmed: true },
        }),
      )
    ).status,
  ).toBe(200);
  expect(mocks.mutate).toHaveBeenCalled();
  expect(network).not.toHaveBeenCalled();
});
it("the fake payment endpoint cannot confirm a Supabase booking", async () => {
  expect(
    (
      await mockPayment(
        post("/api/payments/mock", { token: id, result: "success" }),
      )
    ).status,
  ).toBe(403);
  expect(mocks.simulate).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(network).not.toHaveBeenCalled();
});
it.each(["create", "retrieve", "expire", "confirm", "refund"])(
  "retained Stripe client blocks %s at transport after switching to mock",
  async (operation) => {
    vi.stubEnv("PAYMENT_PROVIDER", "stripe");
    const client = stripeClient();
    vi.stubEnv("PAYMENT_PROVIDER", "mock");
    const request = () =>
      operation === "create"
        ? client.checkout.sessions.create({ mode: "payment" })
        : operation === "retrieve"
          ? client.checkout.sessions.retrieve("cs_test_fixture")
          : operation === "expire"
            ? client.checkout.sessions.expire("cs_test_fixture")
            : operation === "confirm"
              ? client.paymentIntents.confirm("pi_test_fixture")
              : client.refunds.create({ payment_intent: "pi_test_fixture" });
    await expect(request()).rejects.toThrow();
    expect(network).not.toHaveBeenCalled();
  },
  15000,
);
it("stripe/test allows SDK transport using a substituted HTTP response, without real Stripe", async () => {
  vi.stubEnv("PAYMENT_PROVIDER", "stripe");
  expect(integrationStatus().Stripe).toBe(true);
  network.mockResolvedValue(
    new Response(
      JSON.stringify({
        id: "cs_test_fixture",
        object: "checkout.session",
        livemode: false,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    ),
  );
  const session =
    await stripeClient().checkout.sessions.retrieve("cs_test_fixture");
  expect(session.id).toBe("cs_test_fixture");
  expect(session.livemode).toBe(false);
  expect(network).toHaveBeenCalledOnce();
});
