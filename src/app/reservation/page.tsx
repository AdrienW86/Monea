import { PageIntro } from "@/components/site";
import { BookingForm } from "@/components/booking-form";
import { getServices, getSettings, integrationStatus } from "@/lib/db/queries";
import { eligible, bookingRestrictions } from "@/lib/catalogue";
import Link from "next/link";
import { isLocalProvider, mockPaymentsEnabled } from "@/lib/data/provider";
import { localRepository } from "@/lib/data/local";
import { pageMetadata } from "@/lib/brand-seo";
export async function generateMetadata() {
  return pageMetadata(
    await getSettings(),
    "Votre rendez-vous",
    "/reservation",
    "Réservez votre parenthèse beauté chez MONÉA à Perpignan selon les prestations et créneaux disponibles.",
  );
}
export default async function Reservation({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const [services, s, p] = await Promise.all([
    getServices(),
    getSettings(),
    searchParams,
  ]);
  const status = integrationStatus();
  const requested = services.find((service) => service.id === p.service);
  const unavailableRequest =
    !!p.service && (!requested || !eligible(requested));
  const bookableServices = services.filter(eligible);
  const local = isLocalProvider();
  const enabled = local
    ? mockPaymentsEnabled() &&
      (await localRepository().settings()).localBookingEnabled
    : status.Supabase &&
      status["Stripe"] &&
      s.bookingEnabled &&
      s.pricesValidated &&
      s.legalReady &&
      s.privacyReady;
  return (
    <section className="section">
      <PageIntro
        eyebrow="UN MOMENT POUR VOUS"
        title="Votre prochain rendez-vous."
      >
        <p>
          Choisissez votre prestation et votre créneau. Prenez le temps, on
          s’occupe des détails.
        </p>
      </PageIntro>
      {unavailableRequest ? (
        <p className="notice" role="status">
          {requested
            ? `${requested.name} : ${bookingRestrictions(requested).join(" ")}`
            : "Cette prestation n’est pas disponible à la réservation."}{" "}
          <Link
            href={requested ? `/prestations/${requested.slug}` : "/prestations"}
          >
            Consulter les prestations
          </Link>
        </p>
      ) : bookableServices.length === 0 ? (
        <p className="notice">
          Aucune prestation n’est ouverte à la réservation en ligne.
        </p>
      ) : (
        <BookingForm
          localMode={local}
          checkoutMinutes={s.checkoutMinutes}
          holdMinutes={s.holdMinutes}
          services={bookableServices}
          enabled={enabled}
          initial={p.service}
        />
      )}
    </section>
  );
}
