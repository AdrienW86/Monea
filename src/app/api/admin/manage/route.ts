import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireManagementAdmin } from "@/lib/auth/management";
import { repository } from "@/lib/data/repository";
import { snapshotQuerySchema } from "@/lib/data/snapshot-query";
import { DataError } from "@/lib/data/types";
import { sameOrigin, limit, readJson, failure } from "@/lib/security";
export async function GET(req: NextRequest) {
  try {
    const admin = await requireManagementAdmin();
    const repo = repository();
    const query = req.nextUrl.searchParams.has("section")
      ? snapshotQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams))
      : undefined;
    await limit(req, "management-read", 240);
    const data = await repo.snapshot(
      req.nextUrl.searchParams.get("export") === "json"
        ? { section: "all" }
        : query,
      admin.id,
    );
    if (req.nextUrl.searchParams.get("export") === "json")
      return new NextResponse(
        JSON.stringify(
          {
            schema_version: 2,
            source: repo.provider,
            exported_at: new Date().toISOString(),
            data,
          },
          null,
          2,
        ),
        {
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition":
              'attachment; filename="monea-local-export.json"',
            "Cache-Control": "private, no-store",
          },
        },
      );
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const admin = await requireManagementAdmin();
    await limit(req, "local-admin", 150);
    const result = await repository().mutate(await readJson(req), admin.id);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    if (e instanceof DataError)
      return NextResponse.json(
        {
          error: e.message,
          conflicts: e.conflicts.map(({ id, start_at, end_at, kind }) => ({
            id,
            start_at,
            end_at,
            kind,
          })),
        },
        { status: e.conflicts.length ? 409 : 400 },
      );
    if (e instanceof ZodError)
      return NextResponse.json(
        {
          error: e.issues
            .map((i) => `${i.path.join(".")} : ${i.message}`)
            .join(" · "),
        },
        { status: 422 },
      );
    return failure(e);
  }
}
