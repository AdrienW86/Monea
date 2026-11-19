import Link from "next/link";
import { getSettings } from "@/lib/db/queries";
import { PageIntro } from "@/components/site";
import {
  LegalContact,
  LegalDraftNotice,
  ConsumerMediation,
} from "@/components/legal-information";
export const metadata = {
  title: "Conditions générales de vente",
  description: "Conditions applicables aux réservations de prestations MONÉA.",
};
export default async function Terms() {
  const s = await getSettings();
  return (
    <section className="section narrow prose">
      <PageIntro eyebrow="RÉSERVATIONS" title="Conditions générales de vente" />
      <LegalDraftNotice
        ready={s.legalReady && s.privacyReady && s.bookingEnabled}
      />
      <h2>Professionnel et prestations</h2>
      <p>
        {s.legalName}, exerçant sous le nom {s.name}, {s.legalAddress}.{" "}
        {s.registration}.
      </p>
      {s.vatNumber && <p>TVA intracommunautaire : {s.vatNumber}</p>}
      <LegalContact settings={s} />
      <p>
        Les présentes conditions concernent les prestations réservées sur le
        site par des consommateurs. Leurs caractéristiques, leur durée et leur
        prix sont indiqués dans le <Link href="/prestations">catalogue</Link>.
        La prestation est réalisée à la date, à l’heure et au lieu indiqués lors
        de la réservation.
      </p>
      <h2>Prix, réservation et paiement</h2>
      <p>
        Les prix sont exprimés en euros, toutes taxes comprises. Le prix total
        et le rendez-vous choisi sont récapitulés avant le paiement. Vous pouvez
        vérifier et corriger vos informations avant de confirmer la commande
        avec obligation de paiement.
      </p>
      <p>
        Le prix de la prestation est payable en totalité lors de la réservation,
        par carte bancaire sur la page sécurisée du prestataire de paiement. La
        réservation est confirmée après validation du paiement. Une tentative de
        paiement non aboutie ne confirme pas le rendez-vous.
      </p>
      <h2>Rétractation</h2>
      <p>
        Pour une réservation conclue à distance, vous disposez de quatorze jours
        à compter de la conclusion du contrat pour vous rétracter, sans avoir à
        justifier votre décision. Vous pouvez utiliser le formulaire ci-dessous
        ou adresser une déclaration claire à l’exploitante, par courrier à
        l’adresse indiquée ci-dessus
        {s.email ? ` ou par e-mail à ${s.email}` : ""}.
      </p>
      <p>
        Si vous demandez expressément l’exécution de la prestation avant la fin
        de ce délai, puis vous rétractez après son commencement, seul le montant
        proportionnel au service fourni peut être dû, dans les conditions
        légales. Le droit de rétractation ne disparaît après une prestation
        entièrement exécutée que si votre accord exprès et votre reconnaissance
        préalable de la perte de ce droit ont été recueillis.
      </p>
      <p>
        Les sommes légalement remboursables à la suite d’une rétractation sont
        restituées dans les quatorze jours suivant la notification, par le même
        moyen de paiement, sauf accord exprès pour un autre moyen sans frais.
      </p>
      <h3>Formulaire type de rétractation</h3>
      <p>
        À compléter et à envoyer uniquement si vous souhaitez vous rétracter.
      </p>
      <blockquote>
        À l’attention de {s.legalName}, {s.legalAddress}
        {s.email ? `, ${s.email}` : ""}.<br />
        Je vous notifie par la présente ma rétractation du contrat portant sur
        la prestation suivante : …<br />
        Commandée le : … Référence de réservation : …<br />
        Nom et prénom du consommateur : …<br />
        Adresse du consommateur : …<br />
        Date : … Signature, uniquement pour un envoi sur papier : …
      </blockquote>
      {!(s.legalReady && s.bookingEnabled) && (
        <p className="notice">
          Avant l’ouverture des ventes en ligne, une fonction de rétractation et
          son accusé de réception sur support durable doivent être mis en
          service.
        </p>
      )}
      <h2>Réclamations et litiges</h2>
      <p>
        Pour toute réclamation, demande de modification ou d’annulation,
        contactez l’exploitante aux coordonnées ci-dessus. Une annulation du
        créneau et le traitement d’un remboursement sont deux opérations
        distinctes ; cette distinction ne limite pas vos droits légaux.
      </p>
      <ConsumerMediation settings={s} />
      <p>
        Vous pouvez également saisir la juridiction compétente selon les règles
        légales applicables.
      </p>
    </section>
  );
}
