// Photographies d'illustration fournies dans MONEA_PACK_9_VISUELS_SITE.zip.
// Elles ne sont ni des portraits de Monica ni des preuves de réalisations ou du local.
export const editorial = {
  portrait: "/images/beauty/hero-portrait.webp",
  regard: "/images/beauty/cils-regard.webp",
  ongles: "/images/beauty/ongles-nude.webp",
  visage: "/images/beauty/soin-visage.webp",
  peau: "/images/beauty/bronzage.webp",
  maquillage: "/images/beauty/maquillage.webp",
  ambiance: "/images/beauty/ambiance-institut.webp",
  epilation: "/images/beauty/epilation-cire.webp",
  cadeau: "/images/beauty/carte-cadeau.webp",
};
// Variantes éditoriales réservées au hero : les photos du catalogue restent inchangées.
export const heroEditorial = {
  regard: "/assets/beauty/regard.webp",
  ongles: "/assets/beauty/ongles.webp",
  visage: "/assets/beauty/visage.webp",
  peau: "/assets/beauty/peau.webp",
};
export function serviceVisual(slug: string, category: string) {
  if (slug === "epilation") return editorial.epilation;
  if (slug === "spray-tan" || slug === "uv" || category === "Le corps")
    return editorial.peau;
  if (category === "Le regard") return editorial.regard;
  if (category === "Les ongles" || category === "Mains & pieds")
    return editorial.ongles;
  if (category === "Le visage" || slug === "luminotherapie")
    return editorial.visage;
  if (category === "Le maquillage") return editorial.maquillage;
  return editorial.ambiance;
}
export const careFamilies = [
  {
    name: "Regard",
    detail: "Cils & sourcils",
    category: "Le regard",
    image: editorial.regard,
    label: "Le détail qui change tout",
    slug: "extensions-cils",
  },
  {
    name: "Ongles",
    detail: "Nude, glossy & vous",
    category: "Les ongles",
    image: editorial.ongles,
    label: "Jusqu’au bout des doigts",
    slug: "prothesie-ongulaire",
  },
  {
    name: "Visage",
    detail: "Votre parenthèse douceur",
    category: "Le visage",
    image: editorial.visage,
    label: "Le soin de soi",
    slug: "soin-visage",
  },
  {
    name: "Bronzage",
    detail: "L’envie d’un éclat doré",
    category: "Le corps",
    image: editorial.peau,
    label: "Un éclat doré",
    slug: "spray-tan",
  },
  {
    name: "Épilation",
    detail: "Une peau, toute en douceur",
    category: "Le corps",
    image: editorial.epilation,
    label: "Tout en douceur",
    slug: "epilation",
  },
  {
    name: "Maquillage",
    detail: "Une occasion de rayonner",
    category: "Le maquillage",
    image: editorial.maquillage,
    label: "Votre mise en beauté",
    slug: "maquillage",
  },
  {
    name: "Bien-être",
    detail: "Le temps de ralentir",
    category: "Le corps",
    image: editorial.ambiance,
    label: "Votre moment à vous",
    slug: "modelage",
  },
];
