import { NextRequest, NextResponse } from "next/server";
import { bookingSchema } from "@/lib/validation";
import { sameOrigin, limit, failure, readJson } from "@/lib/security";
import { db } from "@/lib/db/server";
import { stripeClient } from "@/lib/payments/stripe";
import { requireStripePayments } from "@/lib/payments/provider.mjs";
import { integrationStatus } from "@/lib/db/queries";
import { isLocalProvider, mockPaymentsEnabled } from "@/lib/data/provider";
import { localRepository } from "@/lib/data/local";
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    if (isLocalProvider()) {
      if (!mockPaymentsEnabled()) throw Error("UNAVAILABLE");
      const input = bookingSchema.parse(await readJson(req));
      await limit(req, "booking");
      const b = await localRepository().createBooking({
        service_ids: [input.service_id],
        start_at: input.start_at,
        request_id: input.request_id,
        client: input,
      });
      return NextResponse.json({
        url: `/paiement-local?token=${b.public_token}`,
        provider: "mock",
      });
    }
    requireStripePayments();
    const integrations = integrationStatus();
    if (!integrations.Stripe || !integrations.Supabase)
      throw Error("UNAVAILABLE");
    const input = bookingSchema.parse(await readJson(req));
    await limit(req, "booking");
    const { data: b, error } = await db().rpc("create_booking", {
      p_service: input.service_id,
      p_start: input.start_at,
      p_client: input,
      p_request: input.request_id,
    });
    if (error)
      throw Error(
        error.code === "23P01" ? "Créneau indisponible" : "UNAVAILABLE",
      );
    if (b.status && b.status !== "pending")
      return NextResponse.json({ url: `/reservation/retour?token=${b.token}` });
    const stripe = stripeClient();
    const origin = new URL(process.env.NEXT_PUBLIC_APP_URL!).origin;
    if (b.stripe_session_id) {
      const existing = await stripe.checkout.sessions.retrieve(
        b.stripe_session_id,
      );
      return NextResponse.json({
        url:
          existing.status === "open" && existing.url
            ? existing.url
            : `/reservation/retour?token=${b.token}`,
      });
    }
    // La session n'est pas annulée en cas de timeout ambigu : le hold expire naturellement.
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        allowed_payment_method_types: ["card"],
        client_reference_id: b.id,
        customer_email: input.email,
        expires_at: b.checkout_expires_at
          ? Math.floor(new Date(b.checkout_expires_at).getTime() / 1000)
          : Math.floor(Date.now() / 1000) + b.checkout_minutes * 60,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: b.price_cents,
              product_data: { name: b.service_name },
            },
          },
        ],
        metadata: { booking_id: b.id, request_id: input.request_id },
        success_url: `${origin}/reservation/retour?token=${b.token}`,
        cancel_url: `${origin}/reservation/retour?token=${b.token}`,
      },
      { idempotencyKey: input.request_id },
    );
    const attached = await db().rpc("attach_checkout", {
      p_booking: b.id,
      p_session: session.id,
    });
    if (attached.error) throw Error("UNAVAILABLE");
    return NextResponse.json({ url: session.url });
  } catch (e) {
    return failure(e);
  }
}
