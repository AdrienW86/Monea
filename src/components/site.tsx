import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ArrowUpRight, Heart, Sparkles } from "lucide-react";
import type { Brand } from "@/config/brand";
import { whatsappLink } from "@/lib/booking/time";
import { MobileMenu } from "@/components/mobile-menu";
import { IntroPortrait } from "@/components/beauty-art";
export function Header({ settings: s }: { settings: Brand }) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="wordmark" aria-label={`${s.name} · accueil`}>
          <BrandLogo />
        </Link>
        <nav aria-label="Navigation principale" className="desktop-nav">
          <Link href="/prestations">Les prestations</Link>
          <Link href="/#univers">L’univers beauté</Link>
          <Link href="/cartes-cadeaux">Cartes cadeaux</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <Link className="button header-booking" href="/reservation">
          Réserver <ArrowUpRight size={17} />
        </Link>
        <MobileMenu />
      </div>
    </header>
  );
}
export function Footer({ settings: s }: { settings: Brand }) {
  const wa = whatsappLink(s.whatsapp);
  return (
    <footer className="beauty-footer">
      <div className="footer-upper">
        <div className="footer-invitation">
          <p className="eyebrow">BEAUTY, CARE & A LITTLE SELF LOVE</p>
          <p className="footer-title">
            Votre beauté.
            <br />
            <span className="handwritten">Votre petit bonheur.</span>
          </p>
          <Link href="/reservation" className="button coral-button">
            On prend rendez-vous ? <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="footer-contact">
          <p className="eyebrow">ON GARDE LE LIEN</p>
          {wa && (
            <a
              className="footer-whatsapp"
              href={wa}
              target="_blank"
              rel="noreferrer"
            >
              Un petit mot sur WhatsApp <ArrowUpRight size={17} />
            </a>
          )}
          {s.email && (
            <p>
              <a href={`mailto:${s.email}`}>{s.email}</a>
            </p>
          )}
          {s.phone && (
            <p>
              <a href={`tel:${s.phone}`}>{s.phone}</a>
            </p>
          )}
          {s.address && <p>{s.address}</p>}
          <div className="inline-links">
            {[
              ["Facebook", process.env.SOCIAL_FACEBOOK_URL?.trim()],
              [
                "Instagram",
                process.env.SOCIAL_INSTAGRAM_URL?.trim() || s.instagram,
              ],
              ["TikTok", s.tiktok],
              ["Snapchat", process.env.SOCIAL_SNAPCHAT_URL?.trim() || s.snapchat],
            ]
              .filter(([, url]) => url)
              .map(([name, url]) => (
                <a key={name} href={url} target="_blank" rel="noreferrer">
                  {name} ↗
                </a>
              ))}
          </div>
          <p className="footer-city">
            <Sparkles size={15} /> {s.name} · Institut de beauté à {s.city}
          </p>
        </div>
        <Heart
          className="footer-heart"
          size={100}
          strokeWidth={0.6}
          aria-hidden="true"
        />
      </div>
      <Link href="/" className="footer-wordmark" aria-label="MONÉA · accueil">
        <BrandLogo />
      </Link>
      <div className="footer-bottom">
        <span>
          {s.name} · {s.subtitle}
        </span>
        <div>
          <Link href="/mentions-legales">Mentions légales</Link>
          <Link href="/confidentialite">Confidentialité</Link>
          <Link href="/admin">Espace privé</Link>
        </div>
      </div>
    </footer>
  );
}
export function PageIntro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-intro">
      <div className="page-intro-copy">
        <p className="eyebrow">
          <span className="tiny-star" aria-hidden="true">
            ✧
          </span>{" "}
          {eyebrow}
        </p>
        <h1>{title}</h1>
        {children && <div className="intro-copy">{children}</div>}
      </div>
      <IntroPortrait />
    </div>
  );
}
export function WhatsAppButton({
  number,
  service,
}: {
  number: string;
  service?: string;
}) {
  const href = whatsappLink(number, service);
  return href ? (
    <a className="button outline" href={href} target="_blank" rel="noreferrer">
      Une question sur WhatsApp <ArrowUpRight size={16} />
    </a>
  ) : null;
}
