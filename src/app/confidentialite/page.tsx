import { PageIntro } from "@/components/site";
import { getSettings } from "@/lib/db/queries";
export const metadata = {
  title: "Confidentialité",
  description:
    "Informations sur la protection des données et la confidentialité chez MONÉA.",
};
export default async function Privacy() {
  const s = await getSettings();
  return (
    <section className="section narrow prose">
      <PageIntro eyebrow="VOS DONNÉES" title="Confidentialité" />
      {!s.privacyReady && (
        <p className="notice">
          Document en préparation : collecte et réservation désactivées jusqu’à
          validation par la responsable du traitement.
        </p>
      )}
      <h2>Responsable du traitement</h2>
      <p>
        {s.legalName || "Identité à compléter avant ouverture."} {s.email}
      </p>
      <h2>Données et finalités</h2>
      <p>
        Nom, prénom, email et téléphone servent à gérer les demandes et les
        rendez-vous. Les notes ne doivent contenir aucune donnée médicale. Le
        paiement est hébergé par Stripe ; aucune donnée de carte n’est conservée
        ici.
      </p>
      <h2>Base juridique</h2>
      <p>
        Les démarches précontractuelles et l’exécution de la prestation fondent
        la gestion des rendez-vous. L’information relative aux données est
        acceptée séparément. Aucun consentement marketing n’est demandé.
      </p>
      <h2>Destinataires et conservation</h2>
      <p>
        L’administratrice et les prestataires techniques nécessaires : Supabase,
        Stripe et, si activés, Resend et Meta WhatsApp. Conservation
        opérationnelle configurée : {s.retentionDays} jours, à valider selon les
        obligations comptables et légales. Les pièces comptables suivent leur
        propre durée légale.
      </p>
      <h2>Vos droits</h2>
      <p>
        Accès, rectification, effacement selon obligations, limitation,
        opposition et portabilité : contactez la responsable par les coordonnées
        qui seront publiées avant ouverture. Vous pouvez saisir la CNIL.
      </p>
      <h2>Cookies et transferts</h2>
      <p>
        Seuls les cookies nécessaires à la session d’administration sont
        utilisés. Aucun outil publicitaire ni analytics n’est activé. Les lieux
        d’hébergement, sous-traitants, garanties et transferts internationaux
        doivent être vérifiés avant lancement.
      </p>
    </section>
  );
}
