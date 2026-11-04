import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionDb, dbConfigured } from "@/lib/db/server";
import { sameOrigin, limit, failure, readJson } from "@/lib/security";
import { isLocalProvider } from "@/lib/data/provider";
import { localSignIn } from "@/lib/auth/local";
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    if (isLocalProvider()) {
      await limit(req, "local-login", 8);
      const input = z
        .object({ email: z.email(), password: z.string().min(8).max(200) })
        .parse(await readJson(req));
      await localSignIn(input.email, input.password);
      return NextResponse.json({ ok: true, provider: "local" });
    }
    if (!dbConfigured()) throw Error("UNAVAILABLE");
    const input = z
      .object({ email: z.email(), password: z.string().min(8).max(200) })
      .parse(await readJson(req));
    await limit(req, "login", 8);
    const client = await sessionDb();
    const { data, error } = await client.auth.signInWithPassword(input);
    if (error || !data.user) throw Error("UNAUTHORIZED");
    const { data: admin } = await client
      .from("admin_users")
      .select("user_id")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (!admin) {
      await client.auth.signOut();
      throw Error("UNAUTHORIZED");
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
