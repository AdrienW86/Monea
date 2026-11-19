import { getSettings } from "@/lib/db/queries";
import { PageIntro } from "@/components/site";
import {
  LegalContact,
  LegalDraftNotice,
  ConsumerMediation,
} from "@/components/legal-information";
export const metadata = {
  title: "Mentions légales",
  description:
    "Identification de l’exploitante de MONÉA, hébergement et médiation.",
};
export default async function Legal() {
  const s = await getSettings();
  return (
    <section className="section narrow prose">
      <PageIntro eyebrow="INFORMATIONS" title="Mentions légales" />
      <LegalDraftNotice ready={s.legalReady} />
      <h2>Éditeur</h2>
      <p>
        {s.legalName}, exerçant sous le nom commercial {s.name}.
      </p>
      <p>{s.legalAddress}</p>
      <p>{s.registration}</p>
      {s.vatNumber && <p>TVA intracommunautaire : {s.vatNumber}</p>}
      <LegalContact settings={s} />
      <h2>Directrice de la publication</h2>
      <p>{s.publisher}</p>
      <h2>Hébergeur</h2>
      <p>
        {s.host || "Nom, adresse et téléphone de l’hébergeur : à compléter."}
      </p>
      <h2>Médiation de la consommation</h2>
      <ConsumerMediation settings={s} />
    </section>
  );
}
