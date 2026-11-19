"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { eligible, euro, type Service } from "@/lib/catalogue";
import { serviceVisual } from "@/config/editorial";
import { categoryLabel, serviceDescription } from "@/lib/service-presentation";
export function Catalogue({
  services,
  initial = "Tout",
}: {
  services: Service[];
  initial?: string;
}) {
  const [category, setCategory] = useState(
    initial === "Tout" || services.some((s) => s.category === initial)
      ? initial
      : "Tout",
  );
  const categories = ["Tout", ...new Set(services.map((s) => s.category))];
  return (
    <>
      <div className="filters" aria-label="Filtrer les prestations">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={category === c ? "selected" : ""}
            aria-pressed={category === c}
          >
            {categoryLabel(c)}
          </button>
        ))}
      </div>
      <div className="catalogue-grid">
        {services
          .filter((s) => category === "Tout" || s.category === category)
          .map((s) => {
            const image = serviceVisual(s.slug, s.category, s.image);
            return (
              <article className="service-card" key={s.id}>
                {image && (
                  <Image
                    src={image}
                    alt={`Illustration de la prestation ${s.name.toLowerCase()}`}
                    width={600}
                    height={400}
                    className="service-image"
                  />
                )}
                <p className="eyebrow">{categoryLabel(s.category)}</p>
                <h2>
                  <Link href={`/prestations/${s.slug}`}>{s.name}</Link>
                </h2>
                <p>{serviceDescription(s)}</p>
                <div className="service-card-bottom">
                  {s.price_cents !== null ? (
                    <span>{euro(s.price_cents)} TTC</span>
                  ) : (
                    <span>Sur demande</span>
                  )}
                  <Link
                    className="service-booking-action"
                    href={
                      eligible(s) ? `/reservation?service=${s.id}` : "/contact"
                    }
                    aria-label={
                      eligible(s)
                        ? `Réserver ${s.name}`
                        : `Nous contacter pour ${s.name}`
                    }
                  >
                    {eligible(s) ? "Réserver" : "Nous contacter"}{" "}
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
      </div>
    </>
  );
}
