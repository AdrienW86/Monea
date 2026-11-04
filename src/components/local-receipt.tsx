import Link from "next/link";
import type { PublicBooking } from "@/lib/data/types";
import { localDate } from "@/lib/booking/time";
import { PageIntro } from "@/components/site";
export function LocalReceipt({
  booking: b,
}: {
  booking: PublicBooking | null;
}) {
  const confirmed =
    b?.status === "confirmed" && b.payment_status === "mock_paid";
  return (
    <section className="section narrow">
      <PageIntro
        eyebrow="RÉSERVATION LOCALE"
        title={
          confirmed ? "Votre moment est réservé." : "Résultat de la simulation."
        }
      />
      <p className="notice">
        Paiement simulé : aucun débit et aucune notification externe.
      </p>
      {b ? (
        <div className="panel">
          <h2>{b.service_name}</h2>
          <p>{localDate(b.start_at)} · Europe/Paris</p>
          <p>Référence : {b.id.slice(0, 8).toUpperCase()}</p>
          <p role="status">
            {confirmed
              ? "Paiement fictif accepté. Rendez-vous confirmé."
              : b.payment_status === "failed"
                ? "Paiement fictif refusé. Créneau libéré."
                : b.status === "expired"
                  ? "Réservation provisoire expirée. Créneau libéré."
                  : b.status === "cancelled"
                    ? "Rendez-vous annulé. Aucun remboursement automatique."
                    : b.status === "reconciliation"
                      ? "Paiement fictif à réconcilier. Aucun doublon créé."
                      : "En attente du résultat de la simulation."}
          </p>
          {b.status === "pending" && (
            <Link
              className="button"
              href={`/paiement-local?token=${b.public_token}`}
            >
              Reprendre la simulation
            </Link>
          )}
        </div>
      ) : (
        <p>Aucune réservation vérifiable avec ce lien.</p>
      )}
      <Link href="/reservation" className="under-link">
        Choisir un autre rendez-vous
      </Link>
    </section>
  );
}
