import Link from "next/link";
import { ArrowUpRight, ArrowRight, Gift, Leaf } from "lucide-react";
import { getSettings, getServices } from "@/lib/db/queries";
import { editorial, serviceVisual } from "@/config/editorial";
import { Photo, GiftScene } from "@/components/beauty-art";
import { Reveal } from "@/components/reveal";
import { HeroMosaic } from "@/components/hero-mosaic";
import { BotanicalSprig } from "@/components/botanical-sprig";
import { businessSchema, pageMetadata } from "@/lib/brand-seo";
import { euro } from "@/lib/catalogue";
import { serviceDescription } from "@/lib/service-presentation";
export async function generateMetadata() {
  const s = await getSettings();
  const metadata = pageMetadata(s, "Institut de beauté à Perpignan", "/");
  return {
    ...metadata,
    title: { absolute: "MONÉA | Institut de beauté à Perpignan" },
    openGraph: {
      ...metadata.openGraph,
      title: "MONÉA | Institut de beauté à Perpignan",
    },
  };
}
export default async function Home() {
  const [s, services] = await Promise.all([getSettings(), getServices()]);
  const families = [...new Set(services.map((service) => service.category))];
  return (
    <div className="beauty-home spa-home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(businessSchema(s)).replace(/</g, "\\u003c"),
        }}
      />
      <HeroMosaic settings={s} portrait={editorial.portrait} />
      <section
        className="care-section beauty-container"
        aria-labelledby="care-title"
      >
        <Reveal className="beauty-section-heading">
          <div>
            <p className="eyebrow">LES PARENTHÈSES MONÉA</p>
            <h2 id="care-title">
              À chaque envie,
              <br />
              <span className="handwritten">son moment de douceur.</span>
            </h2>
          </div>
          <div className="heading-aside">
            <p>
              Un regard, un geste, une attention.
              <br />
              Explorez les univers de votre beauté.
            </p>
            <Link className="under-link" href="/prestations">
              Tout le catalogue <ArrowUpRight size={17} />
            </Link>
          </div>
        </Reveal>
        <div className="care-photo-grid">
          {families.map((category, i) => (
            <Reveal
              className={`care-reveal care-reveal-${i + 1}`}
              delay={(i % 3) * 60}
              key={category}
            >
              <Link
                href={`/prestations?categorie=${encodeURIComponent(category)}`}
                className={`care-photo-card care-card-${i + 1}`}
              >
                <Photo
                  src={serviceVisual("", category)}
                  alt={`Illustration beauté — ${category}`}
                  sizes="(max-width: 700px) 44vw, (max-width: 1000px) 30vw, 28vw"
                />
                <div className="care-card-copy">
                  <span className="care-card-family">{category}</span>
                  <span className="care-card-detail">
                    Découvrir les prestations
                  </span>
                </div>
                <span className="care-card-arrow">
                  <ArrowUpRight size={20} />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
      <section
        className="spa-universe"
        id="univers"
        aria-labelledby="experience-title"
      >
        <div className="beauty-experience beauty-container">
          <Reveal className="experience-collage">
            <Photo
              src="/images/spa/rituel-naturel.webp"
              alt="Composition d’inspiration spa : lumière de bougie, eucalyptus et matières naturelles"
              className="experience-interior"
              sizes="(max-width: 700px) 90vw, 45vw"
            />
            <div className="spa-material-note">
              <Leaf size={24} strokeWidth={1} />
              <span>
                De la douceur,
                <br />
                <em>dans chaque détail.</em>
              </span>
            </div>
          </Reveal>
          <Reveal className="experience-copy" delay={90}>
            <p className="eyebrow">L’ESPRIT MONÉA</p>
            <h2 id="experience-title">
              Le temps ralentit.
              <br />
              <span className="handwritten">Vous vous retrouvez.</span>
            </h2>
            <p>
              Fermer les yeux. Ralentir un peu. S’accorder cette attention que
              l’on garde trop souvent pour plus tard.
            </p>
            <p>
              À {s.city}, la beauté se vit avec douceur, dans les gestes comme
              dans les détails. Un univers inspiré des matières naturelles et de
              la lumière, pensé pour vous laisser la place d’être vous.
            </p>
            <p className="experience-signature handwritten">
              Avec douceur, Monica
            </p>
            <Link className="under-link" href="/contact">
              Faisons connaissance <ArrowUpRight size={17} />
            </Link>
            <BotanicalSprig className="spa-universe-sprig" />
          </Reveal>
        </div>
      </section>
      <section
        className="beauty-favorites beauty-container"
        aria-labelledby="favorites-title"
      >
        <Reveal className="beauty-section-heading">
          <div>
            <p className="eyebrow">LES PETITES ATTENTIONS</p>
            <h2 id="favorites-title">
              L’élégance se cache
              <br />
              <span className="handwritten">dans les détails.</span>
            </h2>
          </div>
          <p className="favorites-note">
            Cils, sourcils, ongles…
            <br />
            Commencez par ce qui vous fait envie.
          </p>
        </Reveal>
        <div className="favorites-layout">
          <Reveal className="favorites-photo">
            <Photo
              src={editorial.regard}
              alt="Photographie d’illustration d’un regard et de cils recourbés"
              sizes="(max-width: 700px) 90vw, 34vw"
            />
            <span className="handwritten">Un regard, tout simplement.</span>
          </Reveal>
          <Reveal className="beauty-service-list" delay={80}>
            {services.slice(0, 5).map((v, i) => (
              <Link href={`/prestations/${v.slug}`} key={v.id}>
                <span className="beauty-service-index">0{i + 1}</span>
                <div>
                  <h3>{v.name}</h3>
                  <p>{serviceDescription(v)}</p>
                </div>
                <span className="beauty-service-duration">
                  {v.price_cents === null ? "Sur demande" : euro(v.price_cents)}
                </span>
                <ArrowUpRight size={20} />
              </Link>
            ))}
          </Reveal>
        </div>
      </section>
      <section className="spa-gift-wrap" aria-labelledby="gifts-title">
        <div className="beauty-gifts beauty-container">
          <Reveal className="gift-copy">
            <p className="eyebrow">
              <Gift size={15} /> LE PLAISIR D’OFFRIR
            </p>
            <h2 id="gifts-title">
              Un peu de temps.
              <br />
              <span className="handwritten">Beaucoup d’attention.</span>
            </h2>
            <p>
              Offrir une pause, un soin, un moment rien qu’à elle.
              <br />
              Les plus beaux cadeaux sont parfois les plus doux.
            </p>
            <Link className="under-link" href="/cartes-cadeaux">
              Découvrir les cartes cadeaux <ArrowUpRight size={18} />
            </Link>
          </Reveal>
          <Reveal className="gift-art" delay={80}>
            <GiftScene name={s.name} />
          </Reveal>
          <BotanicalSprig className="spa-gift-sprig" />
        </div>
      </section>
      <section
        className="spa-closing beauty-container"
        aria-labelledby="invitation-title"
      >
        <Leaf size={28} strokeWidth={1} />
        <p className="eyebrow">VOTRE PROCHAINE PARENTHÈSE</p>
        <h2 id="invitation-title">
          Et si ce moment était <em>pour vous ?</em>
        </h2>
        <Link href="/reservation" className="button coral-button">
          Choisir ma parenthèse beauté <ArrowRight size={18} />
        </Link>
        <p className="help">Sans compte cliente · Selon les disponibilités</p>
      </section>
    </div>
  );
}
