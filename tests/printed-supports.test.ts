import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { GiftScene } from "@/components/beauty-art";
import { printedSupports } from "@/config/printed-supports";

describe("supports imprimés d’origine", () => {
  it("conserve les octets de la pièce jointe validée et du PDF recto-verso", () => {
    for (const [file, hash] of [
      [
        "public/branding/supports/carte-cadeau-bois-validee.jpg",
        "8e450573502862d4d3111fddfc6a50c1b8988abc13d6b64016d1f3cbf53312cd",
      ],
      [
        "design/validated-supports/carte-visite-source.pdf",
        "53137b1b06cd1d9544c89f488ac3ba4f3bc1093dfd3e74f38d993e9e102375ad",
      ],
    ])
      expect(
        createHash("sha256").update(readFileSync(file)).digest("hex"),
      ).toBe(hash);
  });
  it("affiche le fichier original sans carte recréée ni optimisation destructive", () => {
    const html = renderToStaticMarkup(GiftScene({ name: "MONÉA" }));
    expect(html).toContain(`src="${printedSupports.gift.src}"`);
    expect(html).not.toMatch(
      /gift-envelope|gift-ribbon|beauty-gift-card|_next\/image/,
    );
  });
  it("respecte les proportions réelles des trois supports", async () => {
    for (const art of Object.values(printedSupports)) {
      const metadata = await sharp(`public${art.src}`).metadata();
      expect([art.width, art.height]).toEqual([
        metadata.width,
        metadata.height,
      ]);
    }
  });
});
