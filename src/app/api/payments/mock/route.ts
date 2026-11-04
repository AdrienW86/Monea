import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { mockPaymentsEnabled } from "@/lib/data/provider";
import { localRepository } from "@/lib/data/local";
import { sameOrigin, limit, readJson, failure } from "@/lib/security";
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    if (!mockPaymentsEnabled()) throw Error("FORBIDDEN");
    await limit(req, "mock-payment", 30);
    const input = z
      .object({
        token: z.uuid(),
        result: z.enum(["success", "failed", "expired"]),
      })
      .parse(await readJson(req));
    const booking = await localRepository().simulatePayment(
      input.token,
      input.result,
    );
    return NextResponse.json({
      status: booking.status,
      payment_status: booking.payment_status,
      provider: "mock",
    });
  } catch (e) {
    return failure(e);
  }
}
