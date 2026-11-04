import { NextRequest, NextResponse } from "next/server";
import { contactSchema } from "@/lib/validation";
import { sameOrigin, limit, failure, readJson } from "@/lib/security";
import { db } from "@/lib/db/server";
import { getSettings } from "@/lib/db/queries";
import { isLocalProvider } from "@/lib/data/provider";
import { localRepository } from "@/lib/data/local";
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    if (isLocalProvider()) {
      const input = contactSchema.parse(await readJson(req));
      await limit(req, "contact");
      await localRepository().storeContact(input);
      return NextResponse.json(
        { saved: true, provider: "local" },
        { status: 201 },
      );
    }
    const s = await getSettings();
    if (!s.privacyReady) throw Error("UNAVAILABLE");
    const input = contactSchema.parse(await readJson(req));
    await limit(req, "contact");
    const { error } = await db().rpc("store_contact", { p_data: input });
    if (error) throw Error("UNAVAILABLE");
    return NextResponse.json({ saved: true }, { status: 201 });
  } catch (e) {
    return failure(e);
  }
}
