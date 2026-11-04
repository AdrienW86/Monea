import type { MetadataRoute } from "next";
import { getSettings, getServices } from "@/lib/db/queries";
import { validatedWebsite } from "@/config/brand";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const s = await getSettings();
  const website = validatedWebsite(s.website);
  if (!website || s.demo) return [];
  const services = await getServices();
  return [
    "/",
    "/prestations",
    "/cartes-cadeaux",
    "/contact",
    ...services.map((v) => `/prestations/${v.slug}`),
  ].map((path) => ({ url: `${website}${path}` }));
}
