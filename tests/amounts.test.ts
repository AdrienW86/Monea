import { it, expect } from "vitest";
import { collectedCents } from "@/lib/payments/amounts";
it("conserve le net encaissé après remboursement partiel ou en attente", () => {
  for (const status of ["partial_refund", "refund_pending", "reconciliation"])
    expect(
      collectedCents({
        price_cents: 2000,
        offline_status: null,
        payments: { status, amount_cents: 2000, refunded_cents: 500 },
      }),
    ).toBe(1500);
});
it("un remboursement complet donne zéro et une réservation en attente ne compte pas comme encaissée", () => {
  expect(
    collectedCents({
      price_cents: 2000,
      offline_status: null,
      payments: {
        status: "refunded",
        amount_cents: 2000,
        refunded_cents: 2000,
      },
    }),
  ).toBe(0);
  expect(
    collectedCents({
      price_cents: 2000,
      offline_status: null,
      payments: { status: "pending", amount_cents: 2000, refunded_cents: 0 },
    }),
  ).toBe(0);
});
it("distingue explicitement un paiement hors ligne", () => {
  expect(
    collectedCents({
      price_cents: 2000,
      offline_status: "paid_offline",
      payments: null,
    }),
  ).toBe(2000);
  expect(
    collectedCents({
      price_cents: 2000,
      offline_status: "unpaid",
      payments: null,
    }),
  ).toBe(0);
});
