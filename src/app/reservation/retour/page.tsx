import { PageIntro } from "@/components/site";
import { db, dbConfigured } from "@/lib/db/server";
import { localDate } from "@/lib/booking/time";
import { z } from "zod";
import Link from "next/link";
import { isLocalProvider } from "@/lib/data/provider";
import { localRepository } from "@/lib/data/local";
import { LocalReceipt } from "@/components/local-receipt";
export const metadata = {
  title: "Votre confirmation",
  robots: { index: false, follow: false },
};
export default async function Return({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const p = await searchParams;
  if (isLocalProvider())
    return (
      <LocalReceipt
        booking={
          z.uuid().safeParse(p.token).success
            ? await localRepository().publicBooking(p.token!)
            : null
        }
      />
    );
  let booking = null;
  if (dbConfigured() && z.uuid().safeParse(p.token).success) {
    await db().rpc("expire_holds");
    const { data } = await db()
      .from("bookings")
      .select(
        "id,service_name,status,time_allocations(start_at,end_at),payments(status)",
      )
      .eq("public_token", p.token!)
      .maybeSingle();
    booking = data;
  }
  const paymentStatus = (
    booking?.payments as unknown as { status: string } | null
  )?.status;
  const paid =
    booking?.status === "confirmed" &&
    ["paid", "partial_refund", "refund_pending", "refunded"].includes(
      paymentStatus || "",
    );
  const allocation = booking?.time_allocations as unknown as {
    start_at: string;
  } | null;
  return (
    <section className="section narrow">
      <PageIntro
        eyebrow="VOTRE RÉSERVATION"
        title={paid ? "Votre moment est réservé." : "Vérification du paiement."}
      />
      {booking ? (
        <div className="detail-panel">
          <div>
            <p>Référence : {booking.id.slice(0, 8).toUpperCase()}</p>
            <h2>{booking.service_name}</h2>
            {allocation && (
              <p>{localDate(allocation.start_at)} · Europe/Paris</p>
            )}
            <p role="status">
              {paid
                ? paymentStatus === "refunded"
                  ? "Paiement remboursé. Le rendez-vous reste confirmé tant qu’il n’est pas annulé séparément."
                  : paymentStatus === "partial_refund"
                    ? "Paiement vérifié, partiellement remboursé. Rendez-vous confirmé."
                    : paymentStatus === "refund_pending"
                      ? "Rendez-vous confirmé. Une demande de remboursement est en cours de traitement."
                      : "Paiement vérifié côté serveur. Rendez-vous confirmé."
                : booking.status === "reconciliation"
                  ? "Le paiement nécessite une vérification administrative. Aucun rendez-vous confirmé sur cette page."
                  : booking.status === "expired"
                    ? "La réservation provisoire a expiré."
                    : booking.status === "cancelled"
                      ? "Ce rendez-vous a été annulé."
                      : "En attente de la confirmation sécurisée de Stripe. Cette page ne confirme pas le paiement."}
            </p>
            <Link
              className="button outline"
              href={`/reservation/retour?token=${p.token}`}
            >
              Actualiser le statut
            </Link>
          </div>
        </div>
      ) : (
        <p>
          Aucune réservation vérifiable avec ce lien. Ne transmettez jamais ce
          lien privé.
        </p>
      )}
      <p className="help">
        Le retour de Stripe ne vaut pas preuve de paiement. Seul un événement
        signé et validé permet la confirmation.
      </p>
    </section>
  );
}
