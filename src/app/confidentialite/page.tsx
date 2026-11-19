import { PageIntro } from "@/components/site";
import { getSettings } from "@/lib/db/queries";
import { LegalDraftNotice } from "@/components/legal-information";
export const metadata = {
  title: "Politique de confidentialité",
  description:
    "Utilisation des données personnelles, conservation et exercice de vos droits.",
};
export default async function Privacy() {
  const s = await getSettings();
  return (
    <section className="section narrow prose">
      <PageIntro eyebrow="VOS DONNÉES" title="Politique de confidentialité" />
      <LegalDraftNotice ready={s.privacyReady} />
      <h2>Responsable du traitement</h2>
      <p>
        {s.legalName}, {s.legalAddress}.
      </p>
      {s.email && (
        <p>
          <a href={`mailto:${s.email}`}>{s.email}</a>
        </p>
      )}
      <h2>Données, finalités et bases légales</h2>
      <p>
        Les coordonnées, le contenu des messages et les informations de
        rendez-vous servent à répondre à vos demandes et à gérer vos
        réservations, sur le fondement des mesures précontractuelles et de
        l’exécution du contrat. Les données de facturation sont traitées pour
        respecter les obligations légales. Les journaux techniques et la session
        d’administration servent à sécuriser le site, sur le fondement de
        l’intérêt légitime de l’exploitante.
      </p>
      <p>
        Les champs obligatoires sont signalés dans les formulaires : sans ces
        informations, la demande ou la réservation ne peut pas être traitée. Le
        téléphone est facultatif dans le formulaire de contact. Les données de
        carte bancaire sont traitées par le prestataire de paiement ; elles ne
        sont pas enregistrées dans le site.
      </p>
      <h2>Destinataires et conservation</h2>
      <p>
        Les données sont accessibles à l’exploitante, à l’hébergeur Vercel et
        aux prestataires techniques nécessaires à l’hébergement, à la
        réservation, au paiement et, lorsqu’ils sont utilisés, à l’envoi des
        confirmations.
      </p>
      <p>
        Les données de suivi sont conservées pendant le traitement de la demande
        ou l’exécution de la prestation, puis pendant {s.retentionDays} jours.
        Les justificatifs nécessaires à la preuve d’un contrat sont archivés
        pendant cinq ans ; les pièces comptables pendant dix ans à compter de la
        clôture de l’exercice. Les contrats électroniques d’au moins 120 € sont
        conservés pendant dix ans à compter de la prestation. En cas de litige,
        les données nécessaires sont conservées jusqu’à sa résolution.
      </p>
      {!s.privacyReady && (
        <p className="notice">
          Les lieux d’hébergement, les éventuels transferts hors de l’Espace
          économique européen et leurs garanties restent à préciser avant la
          mise en service.
        </p>
      )}
      <h2>Vos droits</h2>
      <p>
        Vous pouvez demander l’accès à vos données, leur rectification, leur
        effacement, la limitation du traitement et, lorsque les conditions
        légales sont réunies, leur portabilité. Vous pouvez vous opposer aux
        traitements fondés sur l’intérêt légitime pour des raisons tenant à
        votre situation. Pour exercer ces droits, écrivez à {s.legalName},{" "}
        {s.legalAddress}
        {s.email ? `, ou à ${s.email}` : ""}.
      </p>
      <p>
        Vous pouvez déposer une réclamation auprès de la{" "}
        <a href="https://www.cnil.fr/fr/plaintes">CNIL</a>.
      </p>
      <h2>Cookies</h2>
      <p>
        Le site utilise un cookie de session nécessaire à la connexion de
        l’administratrice. Aucun traceur publicitaire ou outil de mesure
        d’audience n’est installé sur le site.
      </p>
    </section>
  );
}
