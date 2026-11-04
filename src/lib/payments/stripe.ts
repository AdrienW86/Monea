import "server-only";
import Stripe from "stripe";
import { requireStripePayments } from "./provider.mjs";
export function stripeSecretKey() {
  const configured = process.env.STRIPE_API_KEY?.trim();
  const legacy = process.env.STRIPE_SECRET_KEY?.trim();
  if (configured && legacy && configured !== legacy) return undefined;
  return configured || legacy;
}
export function livePaymentsAllowed() {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_LIVE_PAYMENTS === "true"
  );
}
export function stripeKeyAllowed() {
  const key = stripeSecretKey();
  const publishable = process.env.STRIPE_PUBLISHABLE_KEY?.trim();
  if (
    publishable &&
    (!/^pk_(test|live)_[A-Za-z0-9_]+$/.test(publishable) ||
      publishable.startsWith("pk_live_") !== !!key?.startsWith("sk_live_"))
  )
    return false;
  return (
    !!key &&
    /^sk_(test|live)_[A-Za-z0-9_]+$/.test(key) &&
    (key.startsWith("sk_test_") ||
      (key.startsWith("sk_live_") && livePaymentsAllowed()))
  );
}
export function stripeClient() {
  requireStripePayments();
  const key = stripeSecretKey();
  if (!stripeKeyAllowed())
    throw new Error(
      "Clé Stripe absente ou mode live non autorisé explicitement.",
    );
  return new Stripe(key!, {
    maxNetworkRetries: 2,
    // Also guard clients retained before the provider was disabled, and every retry.
    httpClient: Stripe.createFetchHttpClient((input, init) => {
      requireStripePayments();
      return fetch(input, init);
    }),
  });
}
