import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db/server";
import { processOutbox } from "@/lib/notifications/worker";
import { isLocalProvider } from "@/lib/data/provider";
export async function POST(req: NextRequest) {
  if (isLocalProvider())
    return NextResponse.json(
      { error: "Les tâches externes sont désactivées en mode local." },
      { status: 503 },
    );
  const expected = process.env.CRON_SECRET;
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (
    !expected ||
    !token ||
    Buffer.byteLength(token) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  )
    return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  try {
    const { error } = await db().rpc("expire_holds");
    if (error) throw Error();
    return NextResponse.json({ processed: await processOutbox() });
  } catch {
    return NextResponse.json(
      { error: "Maintenance indisponible" },
      { status: 503 },
    );
  }
}
