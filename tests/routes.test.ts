import { beforeEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import Stripe from "stripe";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/server", () => ({
  db: () => ({ rpc }),
  dbConfigured: () => true,
}));
import { POST as webhook } from "@/app/api/webhooks/stripe/route";
const secret = "whsec_local_only";
beforeEach(() => {
  vi.stubEnv("PAYMENT_PROVIDER", "stripe");
  vi.stubEnv("DATA_PROVIDER", "supabase");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_local_only");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
  rpc.mockReset();
  rpc.mockResolvedValue({ data: "paid", error: null });
});
function request(type: string, object: unknown, valid = true, live = false) {
  const payload = JSON.stringify({
    id: "evt_local",
    type,
    livemode: live,
    data: { object },
  });
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: valid ? secret : "wrong",
  });
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body: payload,
    headers: { "stripe-signature": signature },
  });
}
describe("webhook signé sans aucun appel Stripe externe", () => {
  it("une signature invalide ne touche pas la base", async () => {
    expect(
      (await webhook(request("checkout.session.completed", {}, false))).status,
    ).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("refuse une signature ancienne et un secret webhook absent", async () => {
    const payload = JSON.stringify({
      id: "evt_old",
      type: "checkout.session.completed",
      livemode: false,
      data: { object: {} },
    });
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret,
      timestamp: Math.floor(Date.now() / 1000) - 600,
    });
    const old = () =>
      new NextRequest("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: payload,
        headers: { "stripe-signature": signature },
      });
    expect((await webhook(old())).status).toBe(400);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect(
      (await webhook(request("checkout.session.completed", {}))).status,
    ).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("préserve SQLite : aucun webhook Stripe n’y est accepté", async () => {
    vi.stubEnv("DATA_PROVIDER", "local");
    try {
      expect(
        (await webhook(request("checkout.session.completed", {}))).status,
      ).toBe(503);
      expect(rpc).not.toHaveBeenCalled();
    } finally {
      vi.stubEnv("DATA_PROVIDER", "supabase");
    }
  });
  it("un paiement non payé ne confirme pas", async () => {
    expect(
      (
        await webhook(
          request("checkout.session.completed", { payment_status: "unpaid" }),
        )
      ).status,
    ).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("un événement live est refusé même signé", async () => {
    expect(
      (await webhook(request("checkout.session.completed", {}, true, true)))
        .status,
    ).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("une clé test refuse un événement live même avec le flag de production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_LIVE_PAYMENTS", "true");
    try {
      expect(
        (await webhook(request("checkout.session.completed", {}, true, true)))
          .status,
      ).toBe(400);
      expect(rpc).not.toHaveBeenCalled();
    } finally {
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("ALLOW_LIVE_PAYMENTS", "");
    }
  });
  it("un paiement signé et payé passe à la transaction atomique", async () => {
    expect(
      (
        await webhook(
          request("checkout.session.completed", {
            id: "cs_local",
            payment_status: "paid",
            payment_intent: "pi_local",
            amount_total: 2000,
            currency: "eur",
          }),
        )
      ).status,
    ).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "process_payment_event",
      expect.objectContaining({
        p_session: "cs_local",
        p_amount: 2000,
        p_state: "paid",
      }),
    );
  });
  it.each([
    ["checkout.session.async_payment_succeeded", "paid"],
    ["checkout.session.async_payment_failed", "failed"],
    ["checkout.session.expired", "expired"],
  ])("traite %s", async (type, state) => {
    await webhook(
      request(type, {
        id: "cs_local",
        payment_status: state === "paid" ? "paid" : "unpaid",
        payment_intent: "pi_local",
        amount_total: 2000,
        currency: "eur",
      }),
    );
    expect(rpc).toHaveBeenCalledWith(
      "process_payment_event",
      expect.objectContaining({ p_state: state }),
    );
  });
  it("renvoie 500 pour une session encore inconnue afin que Stripe réessaie", async () => {
    rpc.mockResolvedValue({ error: { message: "unknown" } });
    expect(
      (
        await webhook(
          request("checkout.session.completed", {
            id: "cs_local",
            payment_status: "paid",
          }),
        )
      ).status,
    ).toBe(500);
  });
  it.each([
    { amount_total: null, currency: "eur" },
    { amount_total: 2000, currency: null },
    { amount_total: -1, currency: "eur" },
  ])(
    "refuse une enveloppe signée avec montant ou devise invalide",
    async (patch) => {
      expect(
        (
          await webhook(
            request("checkout.session.completed", {
              id: "cs_invalid",
              payment_status: "paid",
              payment_intent: "pi_invalid",
              ...patch,
            }),
          )
        ).status,
      ).toBe(500);
      expect(rpc).not.toHaveBeenCalled();
    },
  );
});
