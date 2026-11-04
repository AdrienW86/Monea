import { getSettings } from "@/lib/db/queries";
import { PageIntro } from "@/components/site";
export const metadata = {
  title: "Mentions légales",
  description:
    "Informations légales relatives au site MONÉA et à son exploitante.",
};
export default async function Legal() {
  const s = await getSettings();
  return (
    <section className="section narrow prose">
      <PageIntro eyebrow="INFORMATIONS" title="Mentions légales" />
      {s.legalReady ? (
        <>
          <h2>Éditeur</h2>
          <p>
            {s.legalName} · {s.registration}
          </p>
          <p>{s.legalAddress}</p>
          <h2>Responsable de publication</h2>
          <p>{s.publisher}</p>
          <h2>Hébergement</h2>
          <p>{s.host}</p>
          <h2>Médiation de la consommation</h2>
          <p>{s.mediator}</p>
          <h2>Contact</h2>
          <p>{s.email}</p>
        </>
      ) : (
        <div className="notice">
          <h2>Informations légales</h2>
          <p>
            Les informations légales de l’établissement ne sont pas renseignées.
          </p>
          <p>
            Ces informations comprennent : identité et statut juridique de
            l’exploitante, SIRET/immatriculation, adresse, contact, responsable
            de publication, hébergeur et médiateur de la consommation.
          </p>
        </div>
      )}
    </section>
  );
}
