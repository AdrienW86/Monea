"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { eligible, euro, type Service } from "@/lib/catalogue";
import { serviceVisual } from "@/config/editorial";
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
            {c}
          </button>
        ))}
      </div>
      <div className="catalogue-grid">
        {services
          .filter((s) => category === "Tout" || s.category === category)
          .map((s) => (
            <article className="service-card" key={s.id}>
              {
                <Image
                  src={s.image || serviceVisual(s.slug, s.category)}
                  alt={`Illustration de l’univers ${s.category.toLowerCase()}`}
                  width={600}
                  height={400}
                  className="service-image"
                />
              }
              <p className="eyebrow">{s.category}</p>
              <span className={`badge ${eligible(s) ? "available" : ""}`}>
                {eligible(s) ? "Réservation en ligne" : "Consultation"}
              </span>
              <h2>
                <Link href={`/prestations/${s.slug}`}>{s.name}</Link>
              </h2>
              <p>{s.description}</p>
              <div className="service-card-bottom">
                {s.price_cents !== null ? (
                  <span>
                    {euro(s.price_cents)} TTC{" "}
                    <small>· {s.duration_minutes} min</small>
                  </span>
                ) : (
                  <span>Sans réservation</span>
                )}
                <Link
                  href={`/prestations/${s.slug}`}
                  aria-label={`Découvrir ${s.name}`}
                >
                  <ArrowUpRight />
                </Link>
              </div>
            </article>
          ))}
      </div>
    </>
  );
}
