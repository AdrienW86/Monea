import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { requireManagementAdmin } from "@/lib/auth/management";
import { isLocalProvider } from "@/lib/data/provider";
import { db } from "@/lib/db/server";
import { sameOrigin, limit, failure } from "@/lib/security";
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    await requireManagementAdmin();
    await limit(req, "media", 15);
    const reader = req.body?.getReader();
    if (!reader) throw Error("INVALID");
    const parts: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > 5 * 1024 * 1024) {
        await reader.cancel();
        throw Error("TOO_LARGE");
      }
      parts.push(next.value);
    }
    const body = Buffer.concat(parts);
    const form = await new Response(body, {
      headers: { "content-type": req.headers.get("content-type") || "" },
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw Error("INVALID");
    const bytes = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(bytes, {
      limitInputPixels: 25000000,
    }).metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format || ""))
      throw Error("INVALID");
    const output = await sharp(bytes)
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
    const image = "/assets/uploads/" + randomUUID() + ".webp";
    if (isLocalProvider()) {
      await mkdir("public/assets/uploads", { recursive: true });
      await writeFile("public" + image, output);
    } else {
      const { error } = await db()
        .storage.from("monea-media")
        .upload(image.split("/").pop()!, output, {
          contentType: "image/webp",
          upsert: false,
        });
      if (error) throw Error("Stockage des médias indisponible.");
    }
    return NextResponse.json({ image });
  } catch (e) {
    return failure(e);
  }
}
