import Image from "next/image";
import { Heart } from "lucide-react";
import { BotanicalSprig } from "@/components/botanical-sprig";
import { printedSupports } from "@/config/printed-supports";
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
    <figure
      className="gift-scene gift-scene-original"
      aria-label={`Carte cadeau ${name}`}
    >
      <a
        href={printedSupports.gift.src}
        target="_blank"
        rel="noreferrer"
        aria-label="Agrandir la carte cadeau MONÉA originale"
      >
        <Image
          {...printedSupports.gift}
          className="validated-gift-image"
          unoptimized
          sizes="(max-width: 700px) 90vw, 52vw"
        />
      </a>
      <figcaption>Le plaisir d’offrir du temps pour soi.</figcaption>
    </figure>
  );
}
export function IntroPortrait() {
  return (
    <div className="intro-portrait" aria-hidden="true">
      <Photo
        src="/images/spa/rituel-naturel.webp"
        className="intro-photo"
        sizes="(max-width: 700px) 100px, 180px"
      />
      <BotanicalSprig className="intro-sprig" />
    </div>
  );
}
