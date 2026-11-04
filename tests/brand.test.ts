import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { renderToStaticMarkup } from "react-dom/server";
import { brand, resolveBrand, validatedWebsite } from "@/config/brand";
import { BrandLogo, BrandWordmark } from "@/components/brand-logo";
import { businessSchema, pageMetadata } from "@/lib/brand-seo";
import { LocalRepository } from "@/lib/data/local";

describe("identité MONÉA", () => {
  it("harmonise les anciens réglages sans toucher à l’identité juridique ni aux règles", () => {
    const s = resolveBrand({
      name: "Monica Beauty",
      subtitle: "BEAUTY STUDIO",
      logo: "",
      legalName: "Exploitante existante",
      noticeHours: 48,
      phone: "+33612345678",
    });
    expect(s.name).toBe("MONÉA");
    expect(s.logo).toBe(brand.logoDark);
    expect(s.legalName).toBe("Exploitante existante");
    expect(s.noticeHours).toBe(48);
    expect(s.phone).toBe("+33612345678");
  });
  it("n’invente aucune adresse ou URL publique", () => {
    expect(validatedWebsite(brand.website)).toBeUndefined();
    for (const url of [
      "http://localhost:3210",
      "https://example.com",
      "https://site.invalid",
      "javascript:alert(1)",
    ])
      expect(validatedWebsite(url)).toBeUndefined();
    expect(
      pageMetadata(brand, "Contact", "/contact").alternates,
    ).toBeUndefined();
    const schema = businessSchema(brand);
    expect(schema).not.toHaveProperty("address");
    expect(schema).not.toHaveProperty("geo");
    expect(schema).not.toHaveProperty("url");
    expect(
      pageMetadata(
        { ...brand, website: "https://domaine-valide.fr/" },
        "Contact",
        "/contact",
      ).alternates,
    ).toEqual({ canonical: "https://domaine-valide.fr/contact" });
  });
  it("conserve MONÉA en texte et évite une annonce redondante du symbole", () => {
    for (const props of [
      {},
      { light: true },
      { symbol: true },
      { light: true, symbol: true },
    ]) {
      const markup = renderToStaticMarkup(BrandLogo(props));
      expect(markup).toContain(`src="${brand.symbol}"`);
      if ("symbol" in props && props.symbol) {
        expect(markup).toContain('alt="MONÉA"');
        expect(markup).not.toContain("brand-name");
      } else {
        expect(markup).toContain('alt=""');
        expect(markup).toContain('aria-hidden="true"');
        expect(markup).toMatch(/class="brand-name[^"]*">MONÉA<\/span>/);
      }
    }
    expect(renderToStaticMarkup(BrandLogo({ size: 28 }))).toContain(
      "--brand-symbol-size:28px",
    );
    expect(renderToStaticMarkup(BrandWordmark({ light: true }))).toContain(
      brand.logoLight,
    );
  });
  it("conserve l’alpha du monogramme et fournit un ICO multi-résolutions valide", async () => {
    const meta = await sharp(`public${brand.symbol}`).metadata();
    expect(meta.hasAlpha).toBe(true);
    const { data, info } = await sharp(`public${brand.symbol}`)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(data[3]).toBe(0);
    let opaque = 0;
    for (let p = 3; p < data.length; p += 4) if (data[p] > 128) opaque++;
    expect(opaque / (info.width * info.height)).toBeGreaterThan(0.08);
    expect(opaque / (info.width * info.height)).toBeLessThan(0.6);
    const ico = readFileSync("src/app/favicon.ico");
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(3);
    for (const [i, size] of [16, 32, 48].entries()) {
      const entry = 6 + i * 16;
      expect([ico[entry], ico[entry + 1]]).toEqual([size, size]);
      const offset = ico.readUInt32LE(entry + 12);
      const length = ico.readUInt32LE(entry + 8);
      const frame = await sharp(
        ico.subarray(offset, offset + length),
      ).metadata();
      expect([frame.width, frame.height, frame.hasAlpha]).toEqual([
        size,
        size,
        true,
      ]);
    }
  });
  it("fournit les dimensions réelles des icônes et de l’image sociale", async () => {
    for (const [file, width, height] of [
      ["apple-touch-icon.png", 180, 180],
      ["icon-192.png", 192, 192],
      ["icon-512.png", 512, 512],
      ["assets/brand/opengraph.png", 1200, 630],
    ] as const) {
      const info = await sharp(`public/${file}`).metadata();
      expect([info.width, info.height]).toEqual([width, height]);
    }
    expect((await sharp("src/app/icon.png").metadata()).width).toBe(512);
    expect((await sharp("src/app/apple-icon.png").metadata()).width).toBe(180);
  });
  it("enregistre les contacts dans SQLite sans altérer les entités existantes", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const repo = new LocalRepository(":memory:");
    try {
      const before = await repo.snapshot();
      await repo.mutate(
        {
          action: "settings_save",
          data: {
            ...before.settings,
            address: "Adresse de test",
            email: "contact@example.invalid",
            phone: "+33612345678",
            website: "",
            instagram: "https://www.instagram.com/compte_test/",
          },
        },
        "test-admin",
      );
      const after = await repo.snapshot();
      expect(after.settings.email).toBe("contact@example.invalid");
      expect(after.settings.name).toBe("MONÉA");
      expect(after.services).toEqual(before.services);
      expect(after.bookings).toEqual(before.bookings);
      await expect(
        repo.mutate(
          {
            action: "settings_save",
            data: { ...after.settings, instagram: "javascript:alert(1)" },
          },
          "test-admin",
        ),
      ).rejects.toThrow();
    } finally {
      repo.connection.close();
      vi.unstubAllEnvs();
    }
  });
});
