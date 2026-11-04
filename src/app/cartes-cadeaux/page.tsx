import { PageIntro } from "@/components/site";
import Link from "next/link";
import { GiftScene } from "@/components/beauty-art";
import { getSettings } from "@/lib/db/queries";
import { pageMetadata } from "@/lib/brand-seo";
export async function generateMetadata() {
  return pageMetadata(
    await getSettings(),
    "Cartes cadeaux",
    "/cartes-cadeaux",
    "Découvrez l’univers des cartes cadeaux MONÉA. Disponibilité et modalités à confirmer auprès de l’institut.",
  );
}
export default async function Gifts() {
  const s = await getSettings();
  return (
    <section className="section narrow">
      <PageIntro
        eyebrow="LE PLAISIR D’OFFRIR"
        title="Une attention qui fait du bien."
      >
        <p>
          Offrir du temps pour soi. Une attention pour les personnes que vous
          aimez.
        </p>
      </PageIntro>
      <div className="gift-page-scene">
        <GiftScene name={s.name} />
      </div>
      <div className="detail-panel">
        <div>
          <h2>
            Les belles attentions
            <br />
            <em>à partager.</em>
          </h2>
          <p>
            Pour connaître les modalités des cartes cadeaux, contactez MONÉA.
          </p>
          <Link href="/contact" className="button">
            Nous contacter
          </Link>
        </div>
      </div>
    </section>
  );
}
