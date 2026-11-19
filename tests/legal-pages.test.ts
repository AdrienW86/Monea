import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { brand, resolveBrand } from "@/config/brand";
import Legal from "@/app/mentions-legales/page";
import Privacy from "@/app/confidentialite/page";
import Terms from "@/app/conditions-generales-de-vente/page";
vi.mock("@/lib/db/queries", () => ({ getSettings: async () => brand }));

it("renseigne les anciens réglages vides sans remplacer une identité saisie dans l’admin ni valider les pages", () => {
  expect(resolveBrand({ legalName: "", legalAddress: "" })).toMatchObject({
    legalName: brand.legalName,
    legalAddress: brand.legalAddress,
    legalReady: false,
    privacyReady: false,
    bookingEnabled: false,
  });
  expect(
    resolveBrand({ legalName: "Autre identité confirmée" }).legalName,
  ).toBe("Autre identité confirmée");
});

it("identifie l’exploitante sans publier ses données de naissance ni masquer les informations manquantes", async () => {
  for (const page of [Legal, Privacy, Terms]) {
    const html = renderToStaticMarkup(await page());
    expect(html).toContain("Monica Wendy DURU");
    expect(html).toContain("150 avenue Maréchal Joffre");
    expect(html).toContain("Version préparatoire");
    expect(html).not.toMatch(
      /03\/1986|4782Z|F17\/007050|17\/06\/2016|12\/04\/2012/,
    );
  }
});
