import { isLocalProvider } from "@/lib/data/provider";
import { db } from "@/lib/db/server";
import { readFile } from "node:fs/promises";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  if (!/^[a-f0-9-]{36}\.webp$/.test(file))
    return new Response(null, { status: 404 });
  try {
    const bytes = isLocalProvider()
      ? await readFile(`public/assets/uploads/${file}`)
      : await (async () => {
          const { data, error } = await db()
            .storage.from("monea-media")
            .download(file);
          if (error || !data) throw Error("Introuvable");
          return Buffer.from(await data.arrayBuffer());
        })();
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
