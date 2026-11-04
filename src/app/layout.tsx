import type { Metadata } from "next";
import localFont from "next/font/local";
import { getSettings } from "@/lib/db/queries";
import { Header, Footer } from "@/components/site";
import { brandAccents, validatedWebsite } from "@/config/brand";
import { pageMetadata } from "@/lib/brand-seo";
import "./globals.css";
import "./beauty.css";
import "./mosaic.css";
import "./management.css";
import "./brand.css";
const editorialFont = localFont({
  src: "./fonts/Cormorant-Garamond.woff2",
  variable: "--font-editorial",
  weight: "300 700",
  display: "swap",
});
const handwrittenFont = localFont({
  src: "./fonts/Allura.woff2",
  variable: "--font-handwritten",
  weight: "400",
  display: "swap",
});
const sansFont = localFont({
  src: "./fonts/Manrope.woff2",
  variable: "--font-sans",
  weight: "400 700",
  display: "swap",
});
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    ...pageMetadata(s, "Institut de beauté à Perpignan", "/"),
    title: {
      default: "MONÉA | Institut de beauté à Perpignan",
      template: `%s | ${s.name}`,
    },
    alternates: undefined,
    ...(validatedWebsite(s.website)
      ? { metadataBase: new URL(validatedWebsite(s.website)!) }
      : {}),
    manifest: "/manifest.webmanifest",
    robots: {
      index: !s.demo && !!validatedWebsite(s.website),
      follow: !s.demo && !!validatedWebsite(s.website),
    },
  };
}
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const s = await getSettings();
  return (
    <html
      lang="fr"
      data-scroll-behavior="smooth"
      className={`${editorialFont.variable} ${handwrittenFont.variable} ${sansFont.variable}`}
    >
      <body
        style={
          {
            "--night": s.colors.night,
            "--cream": s.colors.cream,
            "--rose": s.colors.rose,
            "--coral": s.colors.coral,
            ...Object.fromEntries(
              Object.entries(brandAccents).map(([key, value]) => [
                `--${key}`,
                value,
              ]),
            ),
          } as React.CSSProperties
        }
      >
        <a className="skip-link" href="#main">
          Aller au contenu
        </a>
        <div className="announcement">
          UN INSTANT À SOI, UNE BEAUTÉ À VOUS <span>✧</span>{" "}
          {s.city.toUpperCase()}
        </div>
        <Header settings={s} />
        <main id="main">{children}</main>
        <Footer settings={s} />
      </body>
    </html>
  );
}
