import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Clock3, Sparkles } from "lucide-react";
import { getServices, getSettings } from "@/lib/db/queries";
import { eligible, euro, bookingRestrictions } from "@/lib/catalogue";
import { PageIntro, WhatsAppButton } from "@/components/site";
import { serviceVisual } from "@/config/editorial";
import { pageMetadata } from "@/lib/brand-seo";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [{ slug }, services, s] = await Promise.all([
    params,
    getServices(),
    getSettings(),
  ]);
  const service = services.find((v) => v.slug === slug);
  if (!service) notFound();
  return pageMetadata(
    s,
    service.name,
    `/prestations/${service.slug}`,
    `${service.description} Disponibilité à vérifier auprès de MONÉA.`,
  );
}
export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [{ slug }, services, s] = await Promise.all([
    params,
    getServices(),
    getSettings(),
  ]);
  const v = services.find((v) => v.slug === slug);
  if (!v) notFound();
  return (
    <section className="section service-detail">
      <Link className="under-link" href="/prestations">
        ← Les prestations
      </Link>
      <PageIntro eyebrow={v.category} title={v.name}>
        <p>{v.description}</p>
      </PageIntro>
      <div className="service-detail-layout">
        <figure className="service-feature-photo">
          <Image
            src={v.image || serviceVisual(v.slug, v.category)}
            alt={`Photographie d’illustration — ${v.category.toLowerCase()}`}
            width={800}
            height={900}
            sizes="(max-width:700px) 90vw, 45vw"
          />
          <span className="service-photo-heart" aria-hidden="true">
            ♡
          </span>
        </figure>
        <div className="service-detail-info">
          <p className="eyebrow">
            <Sparkles size={16} /> VOTRE PARENTHÈSE BEAUTÉ
          </p>
          <h2>
            Les jolis détails,
            <br />
            <span className="handwritten">juste pour vous.</span>
          </h2>
          {v.price_cents !== null ? (
            <>
              <p className="service-feature-price">
                {euro(v.price_cents)} <span>TTC</span>
              </p>
              <p className="service-feature-duration">
                <Clock3 size={15} />
                {v.duration_minutes} minutes
              </p>
            </>
          ) : (
            <p className="notice">
              Tarif non renseigné. Réservation indisponible.
            </p>
          )}
          <p className="service-feature-status">
            {eligible(v)
              ? "Choisissez votre créneau selon les disponibilités."
              : bookingRestrictions(v).join(" ")}
          </p>
          {eligible(v) ? (
            <Link
              className="button coral-button"
              href={`/reservation?service=${v.id}`}
            >
              Voir les disponibilités <ArrowUpRight size={18} />
            </Link>
          ) : (
            <button className="button" disabled>
              Réservation indisponible
            </button>
          )}
          <div className="service-question">
            <h3>Une question avant de vous décider ?</h3>
            <p>Un petit mot, c’est parfois tout ce qu’il faut.</p>
            <WhatsAppButton number={s.whatsapp} service={v.name} />
          </div>
        </div>
      </div>
    </section>
  );
}
