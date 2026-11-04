import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, dbConfigured } from "@/lib/db/server";
import { failure, limit } from "@/lib/security";
import { addDays, format } from "date-fns";
import { isLocalProvider } from "@/lib/data/provider";
import { localRepository } from "@/lib/data/local";
export async function GET(req: NextRequest) {
  try {
    if (!isLocalProvider() && !dbConfigured())
      return NextResponse.json({ slots: [], days: [], configured: false });
    await limit(req, "availability", 240);
    const p = z
      .object({
        service: z.uuid(),
        date: z.iso.date(),
        days: z.coerce.number().int().min(1).max(7).default(1),
      })
      .parse(Object.fromEntries(req.nextUrl.searchParams));
    const days = [];
    // Séquentiel : chaque RPC effectue aussi le nettoyage des holds.
    for (let i = 0; i < p.days; i++) {
      const date = format(
        addDays(new Date(p.date + "T12:00:00"), i),
        "yyyy-MM-dd",
      );
      const { data, error } = isLocalProvider()
        ? {
            data: await localRepository().availability(p.service, date),
            error: null,
          }
        : await db().rpc("availability", {
            p_service: p.service,
            p_date: date,
          });
      if (error) throw Error("UNAVAILABLE");
      days.push({ date, slots: data });
    }
    return NextResponse.json(
      { slots: days[0]?.slots || [], days },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
