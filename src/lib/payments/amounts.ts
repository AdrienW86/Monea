export function collectedCents(booking: {
  price_cents: number;
  offline_status: string | null;
  payments: {
    status: string;
    amount_cents: number;
    refunded_cents: number;
  } | null;
}) {
  const p = booking.payments;
  if (
    p &&
    [
      "paid",
      "partial_refund",
      "refund_pending",
      "refunded",
      "reconciliation",
    ].includes(p.status)
  )
    return Math.max(0, p.amount_cents - p.refunded_cents);
  return booking.offline_status === "paid_offline" ? booking.price_cents : 0;
}
