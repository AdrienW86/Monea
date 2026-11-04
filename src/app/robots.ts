import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/db/queries";
import { validatedWebsite } from "@/config/brand";
export const dynamic = "force-dynamic";
export default async function robots(): Promise<MetadataRoute.Robots> {
  const s = await getSettings();
  const website = validatedWebsite(s.website);
  return website && !s.demo
    ? {
        rules: {
          userAgent: "*",
          allow: "/",
          disallow: [
            "/admin",
            "/api/",
            "/paiement-local",
            "/reservation/retour",
          ],
        },
        sitemap: `${website}/sitemap.xml`,
      }
    : { rules: { userAgent: "*", disallow: "/" } };
}
