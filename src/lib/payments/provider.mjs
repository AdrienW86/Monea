// Shared by server routes and Node diagnostic scripts. Never import in a client component.
if (typeof window !== "undefined")
  throw Error("Server payment configuration only.");

export function paymentProvider() {
  const value = process.env.PAYMENT_PROVIDER;
  return value === "stripe" || value === "mock" ? value : "disabled";
}
export function stripePaymentsEnabled() {
  return (
    paymentProvider() === "stripe" && process.env.DATA_PROVIDER !== "local"
  );
}
export function mockPaymentsEnabled() {
  return (
    paymentProvider() === "mock" &&
    process.env.DATA_PROVIDER === "local" &&
    process.env.NODE_ENV === "development"
  );
}
export class PaymentProviderDisabledError extends Error {
  constructor() {
    super(
      "Opération Stripe désactivée par la configuration du fournisseur de paiement.",
    );
    this.code = "PAYMENT_PROVIDER_DISABLED";
  }
}
export function requireStripePayments() {
  if (!stripePaymentsEnabled()) throw new PaymentProviderDisabledError();
}
