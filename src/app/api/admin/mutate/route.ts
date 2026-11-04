import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, db } from "@/lib/db/server";
import { sameOrigin, limit, failure, readJson } from "@/lib/security";
import { adminSchema } from "@/lib/admin-validation";
import { stripeClient } from "@/lib/payments/stripe";
import { requireStripePayments } from "@/lib/payments/provider.mjs";
import { processOutbox } from "@/lib/notifications/worker";
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const { user } = await requireAdmin();
    const input = adminSchema.parse(await readJson(req));
    // Refuse before prepare_refund changes financial state (and before rate-limit writes).
    if (input.action === "refund") requireStripePayments();
    await limit(req, "admin", 120);
    if (input.action === "run_outbox")
      return NextResponse.json({ processed: await processOutbox() });
    if (input.action === "manual") {
      const { data, error } = await db().rpc("create_booking", {
        p_service: input.data.service_id,
        p_start: input.data.start_at,
        p_client: input.data,
        p_request: input.data.request_id,
        p_actor: user.id,
        p_offline: input.data.offline_status,
      });
      if (error)
        throw Error(
          error.code === "23P01" ? "Créneau indisponible" : "UNAVAILABLE",
        );
      return NextResponse.json(data);
    }
    if (input.action === "refund") {
      const { data: p, error } = await db().rpc("admin_mutate", {
        p_actor: user.id,
        p_action: "prepare_refund",
        p_data: input.data,
      });
      if (error || !p?.stripe_payment_intent) throw Error("UNAVAILABLE");
      const refund = await stripeClient().refunds.create(
        {
          payment_intent: p.stripe_payment_intent,
          amount: p.amount_cents - p.refunded_cents,
        },
        { idempotencyKey: `refund-${p.refund_request_id}` },
      );
      const result = await db()
        .from("payments")
        .update({ refund_id: refund.id })
        .eq("id", p.id);
      if (result.error) throw Error("UNAVAILABLE");
      return NextResponse.json({ requested: true });
    }
    const { data, error } = await db().rpc("admin_mutate", {
      p_actor: user.id,
      p_action: input.action,
      p_data: input.data,
    });
    if (error)
      throw Error(
        error.code === "23P01" ? "Créneau indisponible" : "UNAVAILABLE",
      );
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return failure(e);
  }
}
