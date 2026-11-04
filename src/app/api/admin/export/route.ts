import { NextResponse } from "next/server";
import { requireAdmin, db } from "@/lib/db/server";
import { failure, csvCell } from "@/lib/security";
export async function GET() {
  try {
    const { user } = await requireAdmin();
    const { data, error } = await db()
      .from("bookings")
      .select(
        "id,service_name,status,source,price_cents,created_at,clients(first_name,last_name,email,phone),time_allocations(start_at,end_at),payments(status)",
      );
    if (error) throw Error("UNAVAILABLE");
    const rows = [
      [
        "Référence",
        "Prestation",
        "Statut",
        "Origine",
        "Prix centimes",
        "Début UTC",
        "Fin UTC",
        "Prénom",
        "Nom",
        "Email",
        "Téléphone",
        "Paiement",
      ],
      ...(data || []).map((b) => {
        const c = b.clients as unknown as Record<string, string>;
        const a = b.time_allocations as unknown as Record<string, string>;
        const p = b.payments as unknown as Record<string, string> | null;
        return [
          b.id,
          b.service_name,
          b.status,
          b.source,
          b.price_cents,
          a.start_at,
          a.end_at,
          c.first_name,
          c.last_name,
          c.email,
          c.phone,
          p?.status || "hors ligne",
        ];
      }),
    ];
    await db()
      .from("admin_audit_log")
      .insert({
        actor_id: user.id,
        action: "export_csv",
        detail: { rows: data.length },
      });
    return new NextResponse(
      "\uFEFF" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n"),
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="rendez-vous.csv"',
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (e) {
    return failure(e);
  }
}
