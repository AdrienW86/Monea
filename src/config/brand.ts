import legalIdentity from "@/config/legal-identity.json";

export const brand = {
  name: "MONÉA",
  subtitle: "Institut de beauté",
  description:
    "MONÉA, institut de beauté à Perpignan : beauté du regard, onglerie, soins du visage, bronzage et autres rituels de beauté. Réservation selon les prestations disponibles.",
  slogan: "Prenez du temps pour vous.",
  city: "Perpignan",
  demo: true,
  logo: "/assets/brand/monea-logo-dark.svg",
  logoLight: "/assets/brand/monea-logo-light.svg",
  logoDark: "/assets/brand/monea-logo-dark.svg",
  symbol: "/branding/monea-symbol.png",
  symbolLight: "/branding/monea-symbol.png",
  socialImage: "/assets/brand/opengraph.png",
  heroImage: "",
  favicon: "/favicon.ico",
  website: "",
  colors: {
    night: "#171311",
    cream: "#fff8f2",
    rose: "#f1b4aa",
    coral: "#ae403c",
  },
  address: "",
  phone: "+33644859647",
  email: "contact@institut-monea.fr",
  whatsapp: "",
  instagram: "",
  tiktok: "",
  snapchat: "",
  ...legalIdentity,
  vatNumber: "",
  host: "Vercel Inc. — 440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis — Téléphone : +1 559 288 7060 — https://vercel.com",
  mediator: "",
  legalReady: false,
  privacyReady: false,
  bookingEnabled: false,
  pricesValidated: false,
  retentionDays: 365,
  checkoutMinutes: 30,
  holdMinutes: 35,
  noticeHours: 24,
  horizonDays: 60,
};
export type Brand = typeof brand;

// Apply the approved identity at read time, without migrating saved business data.
// Saved contacts, legal identity, palette and booking rules remain authoritative.
export function resolveBrand<T extends Partial<Brand>>(saved: T) {
  return {
    ...brand,
    ...saved,
    name: brand.name,
    subtitle: brand.subtitle,
    description: brand.description,
    logo: brand.logo,
    logoLight: brand.logoLight,
    logoDark: brand.logoDark,
    symbol: brand.symbol,
    symbolLight: brand.symbolLight,
    socialImage: brand.socialImage,
    favicon: brand.favicon,
    colors: { ...brand.colors, ...saved.colors },
    legalName: saved.legalName || brand.legalName,
    legalAddress: saved.legalAddress || brand.legalAddress,
    registration: saved.registration || brand.registration,
    publisher: saved.publisher || brand.publisher,
    host: saved.host || brand.host,
  };
}

// A domain is published only after it is explicitly supplied in commercial settings.
export function validatedWebsite(website: string): string | undefined {
  try {
    const url = new URL(website);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !url.hostname.includes(".") ||
      /(^|\.)(localhost|invalid|test|example|local)$/.test(url.hostname) ||
      /(^|\.)(example\.(com|org|net))$/.test(url.hostname) ||
      /^\d[\d.]*$/.test(url.hostname)
    )
      return;
    return url.origin;
  } catch {
    return;
  }
}

export const brandAccents = {
  nude: "#e7c6b4",
  powder: "#f5d6ca",
  bronze: "#ac7a58",
  copper: "#bc7662",
};
