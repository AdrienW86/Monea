import Image from "next/image";
import { BrandWordmark } from "@/components/brand-logo";
import { Heart, Sparkles } from "lucide-react";
import { editorial } from "@/config/editorial";
export function Photo({
  src,
  alt = "",
  className = "",
  preload = false,
  sizes = "(max-width: 700px) 90vw, 45vw",
}: {
  src: string;
  alt?: string;
  className?: string;
  preload?: boolean;
  sizes?: string;
}) {
  return (
    <div className={`beauty-photo ${className}`}>
      <Image src={src} alt={alt} fill sizes={sizes} preload={preload} />
    </div>
  );
}
export function PinkSeal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`pink-seal ${className}`}>
      <span>{children}</span>
      <Heart strokeWidth={1.3} aria-hidden="true" />
    </div>
  );
}
export function GiftScene({ name }: { name: string }) {
  return (
    <div
      className="gift-scene"
      aria-label="Composition graphique de carte cadeau"
    >
      <div className="gift-envelope" />
      <div className="gift-ribbon" />
      <div className="beauty-gift-card">
        <Sparkles size={22} strokeWidth={1} aria-hidden="true" />
        <span className="gift-brand" aria-label={name}>
          <BrandWordmark light />
        </span>
        <span className="gift-subtitle">
          LE PLAISIR D’OFFRIR DU TEMPS POUR SOI
        </span>
        <span className="handwritten">rien que pour vous.</span>
        <span className="gift-caption">CARTE CADEAU</span>
      </div>
      <span className="gift-heart" aria-hidden="true">
        ♡
      </span>
    </div>
  );
}
export function IntroPortrait() {
  return (
    <div className="intro-portrait" aria-hidden="true">
      <Photo
        src={editorial.maquillage}
        className="intro-photo"
        sizes="(max-width: 700px) 100px, 180px"
      />
      <span className="intro-heart">♡</span>
    </div>
  );
}
