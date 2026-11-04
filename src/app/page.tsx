import Link from "next/link";
import {
  ArrowUpRight,
  Heart,
  Sparkles,
  Star,
  Gift,
  Instagram,
  Play,
} from "lucide-react";
import { getSettings, getServices } from "@/lib/db/queries";
import { editorial, careFamilies } from "@/config/editorial";
import { Photo, PinkSeal, GiftScene } from "@/components/beauty-art";
import { Reveal } from "@/components/reveal";
import { HeroMosaic } from "@/components/hero-mosaic";
import { businessSchema, pageMetadata } from "@/lib/brand-seo";
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
  const portrait =
    s.heroImage && !s.heroImage.includes("reference-flyer")
      ? s.heroImage
      : editorial.portrait;
  return (
    <div className="beauty-home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(businessSchema(s)).replace(/</g, "\\u003c"),
        }}
      />
      <HeroMosaic settings={s} portrait={portrait} />
      <div className="beauty-ribbon" aria-hidden="true">
        <span>SELF CARE LOOKS GOOD ON YOU</span>
        <Star />
        <span>BEAUTÉ, SOINS & JOLIS MOMENTS</span>
        <Star />
        <span>PRENEZ DU TEMPS POUR VOUS</span>
        <Star />
      </div>
      <section
        className="care-section beauty-container"
        aria-labelledby="care-title"
      >
        <Reveal className="beauty-section-heading">
          <div>
            <p className="eyebrow">LE MENU DE VOS ENVIES</p>
            <h2 id="care-title">
              Votre beauté,
              <br />
              <span className="handwritten">dans les détails.</span>
            </h2>
          </div>
          <div className="heading-aside">
            <p>
              Un peu de soin. Beaucoup de vous.
              <br />À chaque envie, sa parenthèse beauté.
            </p>
            <Link className="under-link" href="/prestations">
              Tout le catalogue <ArrowUpRight size={17} />
            </Link>
          </div>
          <span className="heading-spark" aria-hidden="true">
            ✧
          </span>
        </Reveal>
        <div className="care-photo-grid">
          {careFamilies.map((c, i) => (
            <Reveal
              className={`care-reveal care-reveal-${i + 1}`}
              delay={(i % 4) * 60}
              key={c.name}
            >
              <Link
                href={`/prestations/${c.slug}`}
                className={`care-photo-card care-card-${i + 1}`}
              >
                <Photo
                  src={c.image}
                  alt={`Illustration beauté — ${c.name}`}
                  sizes="(max-width: 700px) 45vw, (max-width: 1000px) 30vw, 25vw"
                />
                <span className="care-card-index">0{i + 1} /</span>
                <span className="care-card-tag">{c.label}</span>
                <div className="care-card-copy">
                  <span className="care-card-family">{c.name}</span>
                  <span className="care-card-detail">{c.detail}</span>
                </div>
                <span className="care-card-arrow">
                  <ArrowUpRight size={21} />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
      <section
        className="beauty-experience beauty-container"
        id="univers"
        aria-labelledby="experience-title"
      >
        <Reveal className="experience-collage">
          <Photo
            src={editorial.ambiance}
            alt="Intérieur imaginé pour illustrer une ambiance douce et chaleureuse ; ce n’est pas le local de Monica."
            className="experience-interior"
            sizes="(max-width: 700px) 90vw, 48vw"
          />
          <div className="experience-frame">
            <Photo
              src={editorial.peau}
              alt="Illustration d’une peau lumineuse dans la lumière du soleil"
              sizes="(max-width: 700px) 45vw, 22vw"
            />
            <span className="handwritten">slow down, glow up.</span>
          </div>
          <span className="experience-heart" aria-hidden="true">
            ♡
          </span>
          <span className="experience-vertical" aria-hidden="true">
            THE ART OF FEELING GOOD
          </span>
        </Reveal>
        <Reveal className="experience-copy" delay={100}>
          <p className="eyebrow">BIENVENUE DANS L’UNIVERS {s.name}</p>
          <h2 id="experience-title">
            Plus qu’un soin.
            <br />
            Un moment
            <br />
            <span className="handwritten">qui vous ressemble.</span>
          </h2>
          <p>
            Fermer les yeux. Ralentir un peu. S’accorder cette attention que
            l’on garde trop souvent pour plus tard.
          </p>
          <p>
            À {s.city}, un univers où la beauté se vit avec douceur, dans les
            gestes comme dans les détails. Une attention pensée pour prendre
            soin de votre temps, et vous laisser la place d’être vous.
          </p>
          <div className="experience-signature">
            <span className="handwritten">Avec douceur, Monica</span>
            <Heart size={26} strokeWidth={1} />
          </div>
          <Link className="under-link" href="/contact">
            Faisons connaissance <ArrowUpRight size={17} />
          </Link>
        </Reveal>
      </section>
      <section className="glow-invitation" aria-labelledby="invitation-title">
        <div className="glow-invitation-inner beauty-container">
          <Reveal className="invitation-copy">
            <p className="eyebrow">ET SI VOTRE PROCHAIN RENDEZ-VOUS…</p>
            <h2 id="invitation-title">
              était avec
              <br />
              <span className="handwritten">vous-même ?</span>
            </h2>
            <p>
              Les journées vont vite. Les jolies parenthèses,
              <br />
              elles, méritent qu’on leur fasse une place.
            </p>
            <Link href="/reservation" className="button coral-button">
              Choisir ma parenthèse beauté <ArrowUpRight size={19} />
            </Link>
            <span className="invitation-tiny">
              SANS COMPTE CLIENTE · HORAIRES SELON DISPONIBILITÉ
            </span>
          </Reveal>
          <Reveal className="invitation-collage" delay={90}>
            <Photo
              src={editorial.maquillage}
              alt="Photographie d’illustration de maquillage dans des tons nude et rosés"
              className="invitation-main"
            />
            <div className="invitation-small">
              <Photo
                src={editorial.ongles}
                alt=""
                sizes="(max-width:700px) 35vw, 200px"
              />
            </div>
            <PinkSeal className="invitation-seal">
              Votre moment.
              <br />
              Votre éclat.
            </PinkSeal>
            <span className="invitation-star" aria-hidden="true">
              ✧
            </span>
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
              Un regard.
              <br />
              <span className="handwritten">Mille façons de vous.</span>
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
              alt="Gros plan d’illustration d’un regard et de cils recourbés"
              sizes="(max-width:700px) 90vw, 34vw"
            />
            <span className="handwritten">the eyes have it.</span>
          </Reveal>
          <Reveal className="beauty-service-list" delay={100}>
            {services.slice(0, 5).map((v, i) => (
              <Link href={`/prestations/${v.slug}`} key={v.id}>
                <span className="beauty-service-index">0{i + 1}</span>
                <div>
                  <h3>{v.name}</h3>
                  <p>{v.description}</p>
                </div>
                <span className="beauty-service-duration">
                  {v.duration_minutes} min
                </span>
                <ArrowUpRight size={20} />
              </Link>
            ))}
          </Reveal>
        </div>
      </section>
      <section
        className="beauty-gifts beauty-container"
        aria-labelledby="gifts-title"
      >
        <Reveal className="gift-copy">
          <p className="eyebrow">
            <Gift size={15} /> POUR LES GENS QU’ON AIME
          </p>
          <h2 id="gifts-title">
            Offrez un peu
            <br />
            de temps.
            <br />
            <span className="handwritten">Et beaucoup d’amour.</span>
          </h2>
          <p>
            Une jolie attention. Un moment rien qu’à elle.
            <br />
          </p>
          <Link className="under-link" href="/cartes-cadeaux">
            Découvrir les cartes cadeaux <ArrowUpRight size={18} />
          </Link>
        </Reveal>
        <Reveal className="gift-art" delay={100}>
          <GiftScene name={s.name} />
        </Reveal>
      </section>
      <section className="beauty-social" aria-labelledby="social-title">
        <div className="beauty-container social-layout">
          <Reveal className="social-copy">
            <p className="eyebrow">UN MOOD. DES INSPIRATIONS. VOUS.</p>
            <h2 id="social-title">
              Un peu de {s.name}
              <br />
              <span className="handwritten">dans votre feed.</span>
            </h2>
            <p>
              Des textures, des teintes, des envies de douceur.
              <br />
              L’univers beauté MONÉA.
            </p>
            {(s.instagram || s.tiktok) && (
              <div className="social-platforms">
                {s.instagram && (
                  <a href={s.instagram} target="_blank" rel="noreferrer">
                    <Instagram size={20} /> Instagram <ArrowUpRight size={15} />
                  </a>
                )}
                {s.tiktok && (
                  <a href={s.tiktok} target="_blank" rel="noreferrer">
                    <Play size={19} /> TikTok <ArrowUpRight size={15} />
                  </a>
                )}
              </div>
            )}
            <span className="social-drawn-heart" aria-hidden="true">
              ♡
            </span>
          </Reveal>
          <Reveal className="social-moodboard" delay={70}>
            <div className="social-back-photo">
              <Photo src={editorial.ambiance} alt="" sizes="230px" />
            </div>
            <div
              className="beauty-phone"
              aria-label="Moodboard d’inspiration beauté"
            >
              <div className="phone-camera" />
              <div className="phone-profile">
                <span className="phone-avatar">{s.name.charAt(0)}</span>
                <div>
                  <strong>{s.name}</strong>
                </div>
                <Sparkles size={18} />
              </div>
              <div className="phone-photos">
                {[
                  editorial.maquillage,
                  editorial.regard,
                  editorial.ambiance,
                  editorial.ongles,
                  editorial.portrait,
                  editorial.peau,
                  editorial.visage,
                  editorial.ambiance,
                  editorial.maquillage,
                ].map((src, i) => (
                  <Photo src={src} key={i} sizes="110px" />
                ))}
              </div>
              <div className="phone-bottom">
                <Heart size={17} />
                <span className="handwritten">save your glow</span>
                <Sparkles size={17} />
              </div>
            </div>
            <span className="social-sticker handwritten" aria-hidden="true">
              self care club ♡
            </span>
            <div className="social-front-photo">
              <Photo src={editorial.ongles} alt="" sizes="160px" />
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
