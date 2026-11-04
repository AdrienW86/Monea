import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.name,
    short_name: brand.name,
    description: brand.description,
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: brand.colors.cream,
    theme_color: brand.colors.night,
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
