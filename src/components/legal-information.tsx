import type { Brand } from "@/config/brand";

export function LegalContact({ settings: s }: { settings: Brand }) {
  return (
    <>
      {s.email ? (
        <p>
          E-mail : <a href={`mailto:${s.email}`}>{s.email}</a>
        </p>
      ) : (
        <p>E-mail professionnel : à compléter.</p>
      )}
      {s.phone ? (
        <p>
          Téléphone : <a href={`tel:${s.phone}`}>{s.phone}</a>
        </p>
      ) : (
        <p>Téléphone professionnel : à compléter.</p>
      )}
    </>
  );
}
export function LegalDraftNotice({ ready }: { ready: boolean }) {
  return ready ? null : (
    <p className="notice">
      Version préparatoire : les informations manquantes doivent être complétées
      avant l’ouverture de la vente en ligne.
    </p>
  );
}
export function ConsumerMediation({ settings: s }: { settings: Brand }) {
  if (!s.mediator)
    return (
      <p>
        Médiateur de la consommation : adhésion et coordonnées à compléter avant
        ouverture.
      </p>
    );
  return (
    <>
      <p>
        Après une réclamation écrite préalable restée sans solution, vous pouvez
        saisir gratuitement le médiateur de la consommation dont relève
        l’établissement.
      </p>
      <p>{s.mediator}</p>
    </>
  );
}
