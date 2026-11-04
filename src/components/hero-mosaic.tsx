import Link from "next/link";
import { ArrowRight, Leaf, MapPin } from "lucide-react";
import type { Brand } from "@/config/brand";
import { Photo } from "@/components/beauty-art";
import { BotanicalSprig } from "@/components/botanical-sprig";

// Preserve the public component contract with a new spa composition.
export function HeroMosaic({
  settings: s,
  portrait,
}: {
  settings: Brand;
  portrait: string;
}) {
  return (
    <section
      className="spa-hero hero-mosaic-section"
      aria-labelledby="hero-title"
    >
      <div className="spa-hero-inner beauty-container">
        <div className="spa-hero-copy">
          <p className="eyebrow">
            <span className="spa-rule" /> MONÉA · INSTITUT DE BEAUTÉ
          </p>
          <h1 id="hero-title">
            {s.slogan === "Prenez du temps pour vous." ? (
              <>
                {"Prenez du temps, "}
                <br />
                <span className="handwritten">rien que pour vous.</span>
              </>
            ) : (
              s.slogan
            )}
          </h1>
          <p className="spa-hero-description">
            Un instant de calme. Des gestes attentionnés.
            <br />
            Une parenthèse de beauté, dans un univers doux et naturel.
          </p>
          <div className="spa-hero-actions">
            <Link className="button coral-button" href="/reservation">
              Réserver mon rendez-vous <ArrowRight size={18} />
            </Link>
            <Link className="under-link" href="/prestations">
              Explorer les prestations <ArrowRight size={16} />
            </Link>
          </div>
          <p className="spa-location">
            <MapPin size={14} strokeWidth={1.3} /> Votre parenthèse beauté à{" "}
            {s.city}
          </p>
          <BotanicalSprig className="spa-hero-sprig" />
        </div>
        <div className="spa-hero-art">
          <div className="spa-hero-image-frame">
            <Photo
              src={
                s.heroImage && !s.heroImage.includes("reference-flyer")
                  ? s.heroImage
                  : "/images/spa/rituel-naturel.webp"
              }
              alt="Composition d’ambiance : eucalyptus, bougie et linge ivoire sur du bois clair"
              className="spa-hero-image"
              preload
              sizes="(max-width: 700px) 92vw, 50vw"
            />
          </div>
          <div className="spa-hero-inset spa-hero-care-detail">
            <Photo
              src={portrait}
              alt="Photographie d’illustration de l’univers beauté MONÉA"
              sizes="(max-width: 700px) 30vw, 190px"
            />
            <span className="handwritten">L’art de prendre soin.</span>
          </div>
          <span className="spa-hero-caption">
            MATIÈRES NATURELLES · INSPIRATION MONÉA
          </span>
          <div className="spa-hero-seal">
            <Leaf size={26} strokeWidth={1} />
            <span>Beauté & douceur</span>
            <small>UN TEMPS POUR SOI</small>
          </div>
        </div>
      </div>
      <div className="spa-hero-bottom beauty-container">
        <span>Beauté du regard</span>
        <span>Ongles & jolis détails</span>
        <span>Soins & bien-être</span>
        <span>Une attention pour vous</span>
      </div>
    </section>
  );
}
