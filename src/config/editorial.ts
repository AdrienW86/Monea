// Illustrations éditoriales : série spa générée, sources et prompts dans design/generated-prestations.json.
// Les photos ne représentent ni Monica, ni des clientes ou réalisations réelles de l’institut.
import { NO_IMAGE } from "@/lib/media";

export const editorial = {
  portrait: "/images/beauty/spa-soin-visage-v2.webp",
  regard: "/images/beauty/spa-extensions-cils-v2.webp",
  ongles: "/images/beauty/spa-prothesie-ongulaire-v2.webp",
  visage: "/images/beauty/spa-soin-visage-v2.webp",
  peau: "/images/beauty/spa-spray-tan-v2.webp",
  maquillage: "/images/beauty/spa-maquillage-v2.webp",
  ambiance: "/images/spa/rituel-naturel.webp",
  epilation: "/images/beauty/spa-epilation-v2.webp",
};
// Une photo propre à chaque prestation du catalogue, y compris au sein d’une catégorie.
const servicePhotos: Record<string, string> = {
  "extensions-cils": editorial.regard,
  "rehaussement-cils": "/images/beauty/spa-regard-v2.webp",
  browlift: "/images/beauty/spa-browlift-v2.webp",
  teinture: "/images/beauty/spa-teinture-cils-sourcils-v2.webp",
  "prothesie-ongulaire": editorial.ongles,
  manucure: "/images/beauty/spa-ongles-v2.webp",
  "beaute-pieds": "/images/beauty/spa-pedicure-v2.webp",
  "nettoyage-peau": "/images/beauty/spa-nettoyage-peau-v2.webp",
  "soin-visage": editorial.visage,
  "gommages-masques": "/images/beauty/spa-visage-v2.webp",
  modelage: "/images/beauty/spa-modelage-v2.webp",
  epilation: "/images/beauty/spa-epilation-sourcils-v1.webp",
  "epilation-levre-superieure":
    "/images/beauty/spa-epilation-levre-superieure-v1.webp",
  "epilation-sourcils-levre-superieure":
    "/images/beauty/spa-epilation-sourcils-levre-superieure-v1.webp",
  "epilation-aisselles": "/images/beauty/spa-epilation-aisselles-v1.webp",
  "epilation-bras": "/images/beauty/spa-epilation-bras-v1.webp",
  "epilation-menton": "/images/beauty/spa-epilation-menton-v1.webp",
  "epilation-demi-jambes": "/images/beauty/spa-epilation-demi-jambes-v1.webp",
  "epilation-jambes-entieres":
    "/images/beauty/spa-epilation-jambes-entieres-v1.webp",
  "spray-tan": editorial.peau,
  maquillage: editorial.maquillage,
  luminotherapie: "/images/beauty/spa-luminotherapie-v2.webp",
  uv: "/images/beauty/spa-uv-v2.webp",
};
export function serviceVisual(
  slug: string,
  category: string,
  image?: string | null,
) {
  const legacy =
    /^(\/images\/beauty\/(hero-portrait|cils-regard|ongles-nude|soin-visage|bronzage|maquillage|ambiance-institut|epilation-cire)\.webp|\/assets\/beauty\/)/;
  if (image === NO_IMAGE) return null;
  if (image && !legacy.test(image)) return image;
  if (servicePhotos[slug]) return servicePhotos[slug];
  if (category === "Épilation") return editorial.epilation;
  if (category === "Onglerie") return editorial.ongles;
  if (category === "Soin") return editorial.visage;
  if (category === "Maquillage") return editorial.maquillage;
  if (slug === "spray-tan" || category === "Le corps") return editorial.peau;
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
    image: "/images/beauty/spa-modelage-v2.webp",
    label: "Votre moment à vous",
    slug: "modelage",
  },
];
