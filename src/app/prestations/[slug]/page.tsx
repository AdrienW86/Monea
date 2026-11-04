import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { getServices, getSettings } from "@/lib/db/queries";
import { eligible, euro } from "@/lib/catalogue";
import { PageIntro, WhatsAppButton } from "@/components/site";
import { serviceVisual } from "@/config/editorial";
import { pageMetadata } from "@/lib/brand-seo";
import { categoryLabel, serviceDescription } from "@/lib/service-presentation";
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
    serviceDescription(service),
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
      <PageIntro eyebrow={categoryLabel(v.category)} title={v.name} />
      <div className="service-detail-layout">
        <figure className="service-feature-photo">
          <Image
            src={serviceVisual(v.slug, v.category, v.image)}
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
          <p className="eyebrow">{categoryLabel(v.category)}</p>
          <p className="service-feature-description">{serviceDescription(v)}</p>
          {v.price_cents !== null ? (
            <>
              <p className="service-feature-price">
                {euro(v.price_cents)} <span>TTC</span>
              </p>
            </>
          ) : (
            <p className="service-feature-price">Sur demande</p>
          )}
          {eligible(v) ? (
            <Link
              className="button coral-button"
              href={`/reservation?service=${v.id}`}
            >
              Voir les disponibilités <ArrowUpRight size={18} />
            </Link>
          ) : (
            <Link className="button outline" href="/contact">
              Nous contacter <ArrowUpRight size={18} />
            </Link>
          )}
          <WhatsAppButton number={s.whatsapp} service={v.name} />
        </div>
      </div>
    </section>
  );
}
