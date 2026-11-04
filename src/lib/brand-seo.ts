import type { Metadata } from "next";
import { brand, validatedWebsite, type Brand } from "@/config/brand";

export function pageMetadata(
  s: Brand,
  title: string,
  path: string,
  description = s.description,
): Metadata {
  const website = validatedWebsite(s.website);
  const image = website
    ? [
        {
          url: `${website}${s.socialImage}`,
          width: 1200,
          height: 630,
          alt: "MONÉA · Institut de beauté à Perpignan",
        },
      ]
    : undefined;
  return {
    title,
    description,
    ...(website ? { alternates: { canonical: `${website}${path}` } } : {}),
    openGraph: {
      title: `${title} | ${brand.name}`,
      description,
      siteName: brand.name,
      locale: "fr_FR",
      type: "website",
      ...(website ? { url: `${website}${path}`, images: image } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${brand.name}`,
      description,
      ...(image ? { images: image } : {}),
    },
  };
}

export function businessSchema(s: Brand) {
  const website = validatedWebsite(s.website);
  return {
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    name: brand.name,
    description: s.description,
    areaServed: { "@type": "City", name: s.city },
    ...(website
      ? {
          url: website,
          image: `${website}${s.socialImage}`,
          logo: `${website}${s.logoDark}`,
        }
      : {}),
    ...(s.address
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: s.address,
            addressLocality: s.city,
            addressCountry: "FR",
          },
        }
      : {}),
    ...(s.phone ? { telephone: s.phone } : {}),
    ...(s.email ? { email: s.email } : {}),
    sameAs: [s.instagram, s.tiktok, s.snapchat].filter(Boolean),
  };
}
