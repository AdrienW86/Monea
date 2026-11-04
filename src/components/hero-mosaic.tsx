import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { Brand } from "@/config/brand";
import { heroEditorial } from "@/config/editorial";
import { Photo } from "@/components/beauty-art";
const tiles = [
  {
    label: "Le regard",
    title: "Sublimez votre regard",
    image: heroEditorial.regard,
    href: "/prestations/extensions-cils",
    status: "Cils & sourcils",
  },
  {
    label: "Les ongles",
    title: "Les jolis détails",
    image: heroEditorial.ongles,
    href: "/prestations/prothesie-ongulaire",
    status: "Prothésie ongulaire",
  },
  {
    label: "Le soin de soi",
    title: "Une pause pour vous",
    image: heroEditorial.visage,
    href: "/prestations/soin-visage",
    status: "Soins du visage",
  },
  {
    label: "Bronzage",
    title: "L’envie de lumière",
    image: heroEditorial.peau,
    href: "/prestations/spray-tan",
    status: "Spray tan",
  },
];
export function HeroMosaic({
  settings: s,
  portrait,
}: {
  settings: Brand;
  portrait: string;
}) {
  return (
    <section className="hero-mosaic-section" aria-labelledby="hero-title">
      <div className="hero-mosaic">
        <div className="mosaic-main">
          <Photo
            src={portrait}
            alt="Portrait beauté d’illustration fourni pour l’univers du site"
            preload
            className="mosaic-main-photo"
            sizes="(max-width: 700px) 100vw, 65vw"
          />
          <div className="mosaic-main-shade" aria-hidden="true" />
          <div className="mosaic-main-copy">
            <h1
              id="hero-title"
              className={
                s.slogan === "Prenez du temps pour vous."
                  ? undefined
                  : "mosaic-custom-title"
              }
            >
              {s.slogan === "Prenez du temps pour vous." ? (
                <>
                  {"Prenez "}
                  <br />
                  {"du temps "}
                  <br />
                  pour{" "}
                  <span className="handwritten mosaic-signature">
                    vous<span aria-hidden="true">♡</span>
                  </span>
                </>
              ) : (
                s.slogan
              )}
            </h1>
            <p className="mosaic-eyebrow">BEAUTÉ · SOINS · BIEN-ÊTRE</p>
            <p className="mosaic-description">
              Un regard sublimé. Des mains soignées. Et ce plaisir de s’accorder
              une parenthèse.
            </p>
            <div className="mosaic-actions">
              <Link className="button mosaic-book" href="/reservation">
                <span>Réserver mon rendez-vous</span>
                <ArrowRight size={20} />
              </Link>
              <Link className="mosaic-discover" href="/prestations">
                Découvrir nos prestations
              </Link>
            </div>
            <p className="mosaic-project">
              MONÉA · Institut de beauté · {s.city}
            </p>
          </div>
        </div>
        {tiles.map((tile, i) => (
          <Link
            className={`mosaic-tile mosaic-tile-${i + 1}`}
            href={tile.href}
            key={tile.label}
          >
            <Photo
              src={tile.image}
              alt={`Illustration — ${tile.label.toLowerCase()}`}
              sizes="(max-width: 700px) 50vw, 20vw"
            />
            <span className="mosaic-tile-shade" aria-hidden="true" />
            <span className="mosaic-tile-status">{tile.status}</span>
            <span className="mosaic-tile-copy">
              <span className="mosaic-category">{tile.label}</span>
              <span className="handwritten mosaic-tile-title">
                {tile.title}
                <span aria-hidden="true">{"\u00a0♡"}</span>
              </span>
            </span>
            <ArrowUpRight
              className="mosaic-tile-arrow"
              size={18}
              aria-hidden="true"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
