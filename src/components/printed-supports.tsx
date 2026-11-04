import Image from "next/image";
import { printedSupports } from "@/config/printed-supports";
import { BotanicalSprig } from "@/components/botanical-sprig";

export function BusinessCards() {
  return (
    <section
      className="printed-supports"
      aria-labelledby="printed-supports-title"
    >
      <div className="printed-supports-copy">
        <p className="eyebrow">L’UNIVERS MONÉA, À EMPORTER</p>
        <h2 id="printed-supports-title">
          Un lien à garder.
          <br />
          <span className="handwritten">Une attention à partager.</span>
        </h2>
        <p>
          Retrouvez les coordonnées et l’univers de l’institut sur notre carte
          de visite.
        </p>
        <BotanicalSprig className="printed-supports-sprig" />
      </div>
      <div className="business-card-pair">
        {(["recto", "verso"] as const).map((side) => (
          <figure key={side}>
            <a
              href={printedSupports[side].src}
              target="_blank"
              rel="noreferrer"
              aria-label={`Agrandir le ${side} de la carte de visite MONÉA`}
            >
              <Image
                {...printedSupports[side]}
                className="validated-business-image"
                unoptimized
                sizes="(max-width: 700px) 40vw, 23vw"
              />
            </a>
            <figcaption>{side === "recto" ? "Recto" : "Verso"}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
