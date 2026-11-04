import { beforeEach, afterEach, it, expect, vi } from "vitest";
import {
  stripeClient,
  stripeKeyAllowed,
  stripeSecretKey,
} from "@/lib/payments/stripe";
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.stubEnv("PAYMENT_PROVIDER", "stripe");
  vi.stubEnv("DATA_PROVIDER", "supabase");
});
it("lit STRIPE_API_KEY sans recopier le secret dans l’alias historique", () => {
  vi.stubEnv("STRIPE_API_KEY", "sk_test_fixture");
  vi.stubEnv("STRIPE_SECRET_KEY", "");
  vi.stubEnv("STRIPE_PUBLISHABLE_KEY", "pk_test_fixture");
  expect(stripeKeyAllowed()).toBe(true);
  expect(stripeSecretKey()).toBe("sk_test_fixture");
  expect(process.env.STRIPE_SECRET_KEY).toBe("");
  expect(stripeClient()).toBeDefined();
});
it("refuse deux alias différents plutôt que de choisir silencieusement", () => {
  vi.stubEnv("STRIPE_API_KEY", "sk_test_one");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_two");
  expect(stripeKeyAllowed()).toBe(false);
  expect(() => stripeClient()).toThrow();
});
it.each(["pk_live_fixture", "pk_invalid", "pk_test_ fixture"])(
  "refuse une clé publique incohérente : %s",
  (key) => {
    vi.stubEnv("STRIPE_API_KEY", "sk_test_fixture");
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("STRIPE_PUBLISHABLE_KEY", key);
    expect(stripeKeyAllowed()).toBe(false);
  },
);
it("les clés live sont refusées par défaut même en production", () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_fixture");
  vi.stubEnv("ALLOW_LIVE_PAYMENTS", "");
  expect(stripeKeyAllowed()).toBe(false);
  expect(() => stripeClient()).toThrow();
});
it("un flag live ne permet pas les paiements live sur le serveur de développement", () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_fixture");
  vi.stubEnv("ALLOW_LIVE_PAYMENTS", "true");
  expect(stripeKeyAllowed()).toBe(false);
});
