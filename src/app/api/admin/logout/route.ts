import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/db/server";
import { sameOrigin, failure } from "@/lib/security";
import { isLocalProvider } from "@/lib/data/provider";
import { localSignOut, requireLocalAdmin } from "@/lib/auth/local";
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    if (isLocalProvider()) {
      await requireLocalAdmin();
      await localSignOut();
      return NextResponse.json({ ok: true });
    }
    const { client } = await requireAdmin();
    await client.auth.signOut();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
