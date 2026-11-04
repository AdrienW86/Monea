export type Service = {
  id: string;
  slug: string;
  name: string;
  category: string;
  category_active?: boolean;
  description: string;
  qualification_requirement:
    "none" | "professional" | "procedure" | "equipment";
  qualification_verified_at: string | null;
  procedure_verified_at: string | null;
  operational_status: "active" | "coming_soon" | "study";
  bookable: boolean;
  visibility: boolean;
  price_cents: number | null;
  duration_minutes: number;
  sort_order: number;
  image: string | null;
};
const entries = [
  [
    "extensions-cils",
    "Extensions de cils",
    "Le regard",
    "Un travail de précision pour souligner votre regard.",
    "none",
  ],
  [
    "rehaussement-cils",
    "Rehaussement de cils",
    "Le regard",
    "Une courbure délicate pour mettre les cils en valeur.",
    "none",
  ],
  [
    "browlift",
    "Browlift",
    "Le regard",
    "Une mise en forme soignée de la ligne des sourcils.",
    "none",
  ],
  [
    "teinture",
    "Teinture des cils et des sourcils",
    "Le regard",
    "Une touche de définition pour les cils et les sourcils.",
    "none",
  ],
  [
    "prothesie-ongulaire",
    "Prothésie ongulaire",
    "Les ongles",
    "Pose de faux ongles, sans manucure préalable.",
    "none",
  ],
  [
    "manucure",
    "Manucure · beauté des mains",
    "Mains & pieds",
    "Un soin esthétique dédié aux mains.",
    "professional",
  ],
  [
    "beaute-pieds",
    "Beauté des pieds",
    "Mains & pieds",
    "Des soins esthétiques pour les pieds.",
    "professional",
  ],
  [
    "nettoyage-peau",
    "Nettoyage de peau",
    "Le visage",
    "Un rituel de nettoyage de la peau.",
    "professional",
  ],
  [
    "soin-visage",
    "Soins du visage",
    "Le visage",
    "Un moment de soin consacré au visage.",
    "professional",
  ],
  [
    "gommages-masques",
    "Gommages et masques",
    "Le visage",
    "Des textures et des gestes de soin.",
    "professional",
  ],
  [
    "modelage",
    "Modelage esthétique",
    "Le corps",
    "Un modelage esthétique du visage ou du corps, sans finalité thérapeutique.",
    "professional",
  ],
  [
    "epilation",
    "Épilation à la cire",
    "Le corps",
    "Une prestation esthétique du visage ou du corps.",
    "professional",
  ],
  [
    "maquillage",
    "Maquillage esthétique",
    "Le maquillage",
    "Une mise en beauté pour vos occasions.",
    "professional",
  ],
  [
    "spray-tan",
    "Spray tan · douche bronzante",
    "Le corps",
    "Procédé et qualification en cours de vérification.",
    "procedure",
  ],
  [
    "luminotherapie",
    "Luminothérapie",
    "Prestations à l’étude",
    "Matériel, sécurité et assurance à valider.",
    "equipment",
  ],
  [
    "uv",
    "Appareil de bronzage UV",
    "Prestations à l’étude",
    "Formation, déclaration, contrôle et assurance spécifiques à valider.",
    "equipment",
  ],
] as const;
export const catalogue: Service[] = entries.map((e, i) => ({
  id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  slug: e[0],
  name: e[1],
  category: e[2],
  description: e[3],
  qualification_requirement: e[4],
  qualification_verified_at: null,
  procedure_verified_at: null,
  operational_status: i >= 14 ? "study" : i < 5 ? "active" : "coming_soon",
  bookable: i < 5,
  visibility: true,
  price_cents: i >= 14 ? null : 2000,
  duration_minutes: 60,
  sort_order: i,
  image: null,
}));
export const euro = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );
export function eligible(s: Service) {
  return (
    s.visibility &&
    s.category_active !== false &&
    s.bookable &&
    s.operational_status === "active" &&
    s.price_cents !== null &&
    s.qualification_requirement !== "equipment" &&
    (s.qualification_requirement === "none" || !!s.qualification_verified_at) &&
    (s.qualification_requirement !== "procedure" || !!s.procedure_verified_at)
  );
}

// Explain the existing booking guards; consulting a service never grants eligibility.
export function bookingRestrictions(s: Service): string[] {
  const reasons: string[] = [];
  if (s.qualification_requirement === "equipment")
    reasons.push(
      "La réservation en ligne est désactivée pour cette prestation soumise aux vérifications de matériel, de sécurité et d’habilitation.",
    );
  if (
    (s.qualification_requirement === "professional" ||
      s.qualification_requirement === "procedure") &&
    !s.qualification_verified_at
  )
    reasons.push("La qualification professionnelle requise n’est pas validée.");
  if (s.qualification_requirement === "procedure" && !s.procedure_verified_at)
    reasons.push("Le procédé doit être validé avant toute réservation.");
  if (s.price_cents === null) reasons.push("Aucun tarif n’est renseigné.");
  if (!s.visibility || s.category_active === false)
    reasons.push(
      "Cette prestation n’est pas ouverte à la réservation publique.",
    );
  if (
    reasons.length === 0 &&
    (!s.bookable || s.operational_status !== "active")
  )
    reasons.push(
      "Cette prestation n’est pas activée pour la réservation en ligne.",
    );
  return reasons;
}
