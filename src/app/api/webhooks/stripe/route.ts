import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import {
  stripeClient,
  livePaymentsAllowed,
  stripeSecretKey,
} from "@/lib/payments/stripe";
import { db } from "@/lib/db/server";
import { readText, failure } from "@/lib/security";
import { requireStripePayments } from "@/lib/payments/provider.mjs";
export async function POST(req: NextRequest) {
  try {
    requireStripePayments();
  } catch (error) {
    return failure(error);
  }
  let event: Stripe.Event;
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!secret?.startsWith("whsec_")) throw Error();
    event = stripeClient().webhooks.constructEvent(
      await readText(req, 1048576),
      req.headers.get("stripe-signature") || "",
      secret,
    );
    if (event.livemode && !livePaymentsAllowed()) throw Error();
    if (event.livemode !== !!stripeSecretKey()?.startsWith("sk_live_"))
      throw Error();
  } catch {
    return NextResponse.json(
      { error: "Signature ou configuration invalide." },
      { status: 400 },
    );
  }
  const allowed = [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "checkout.session.expired",
    "charge.refunded",
  ];
  if (!allowed.includes(event.type))
    return NextResponse.json({ received: true, ignored: true });
  try {
    let args;
    if (event.type === "charge.refunded") {
      const c = event.data.object as Stripe.Charge;
      args = {
        p_session: null,
        p_intent:
          typeof c.payment_intent === "string"
            ? c.payment_intent
            : c.payment_intent?.id,
        p_amount: c.amount,
        p_currency: c.currency,
        p_state: "refunded",
        p_refunded: c.amount_refunded,
      };
    } else {
      const s = event.data.object as Stripe.Checkout.Session;
      if (
        event.type === "checkout.session.completed" &&
        s.payment_status !== "paid"
      )
        return NextResponse.json({ received: true, pending: true });
      if (
        event.type === "checkout.session.async_payment_succeeded" &&
        s.payment_status !== "paid"
      )
        throw Error();
      args = {
        p_session: s.id,
        p_booking: z.uuid().safeParse(s.metadata?.booking_id).success
          ? s.metadata?.booking_id
          : null,
        p_request: z.uuid().safeParse(s.metadata?.request_id).success
          ? s.metadata?.request_id
          : null,
        p_intent:
          typeof s.payment_intent === "string"
            ? s.payment_intent
            : s.payment_intent?.id,
        p_amount: s.amount_total,
        p_currency: s.currency,
        p_state: event.type.endsWith("expired")
          ? "expired"
          : event.type.endsWith("failed")
            ? "failed"
            : "paid",
      };
    }
    // A signed envelope still needs a complete payment amount and currency.
    // SQL comparisons with NULL must never bypass the price check.
    z.object({
      p_amount: z.number().int().nonnegative(),
      p_currency: z.literal("eur"),
      p_intent: z.string().min(1).nullish(),
    }).parse(args);
    if (
      ((args.p_state === "paid" && args.p_amount! > 0) ||
        args.p_state === "refunded") &&
      !args.p_intent
    )
      throw Error();
    if ("p_refunded" in args)
      z.number().int().min(0).max(args.p_amount!).parse(args.p_refunded);
    const { data, error } = await db().rpc("process_payment_event", {
      p_event: event.id,
      p_type: event.type,
      ...args,
    });
    if (error) throw Error();
    return NextResponse.json({ received: true, result: data });
  } catch {
    return NextResponse.json(
      { error: "Traitement non terminé. Réessai nécessaire." },
      { status: 500 },
    );
  }
}
