import { describe, it, expect } from "vitest";
import { catalogue, eligible, bookingRestrictions } from "@/lib/catalogue";
import { bookingSchema, contactSchema, phone } from "@/lib/validation";
import { parisInstant, whatsappLink } from "@/lib/booking/time";
import { csvCell } from "@/lib/security";
import { escapeHtml } from "@/lib/notifications/worker";
describe("catalogue et conformité", () => {
  it("explique les restrictions sans modifier l’éligibilité ni les prix", () => {
    for (const service of catalogue) {
      expect(bookingRestrictions(service).length === 0).toBe(eligible(service));
      if (service.qualification_requirement === "professional")
        expect(bookingRestrictions(service).join(" ")).toContain(
          "qualification professionnelle",
        );
      if (service.qualification_requirement === "procedure")
        expect(bookingRestrictions(service).join(" ")).toContain("procédé");
      if (service.qualification_requirement === "equipment")
        expect(bookingRestrictions(service).join(" ")).toContain("matériel");
    }
    const inactive = { ...catalogue[0], bookable: false };
    expect(bookingRestrictions(inactive).join(" ")).toContain("pas activée");
    expect(eligible({ ...catalogue[0], price_cents: 0 })).toBe(true);
  });
  it("contient 16 services, 5 éligibles et 2 sans prix à l’étude", () => {
    expect(catalogue).toHaveLength(16);
    expect(catalogue.filter(eligible)).toHaveLength(5);
    expect(
      catalogue
        .filter((s) => s.operational_status === "study")
        .every((s) => s.price_cents === null && !eligible(s)),
    ).toBe(true);
  });
  it("un toggle commercial ne contourne pas la qualification ou le procédé", () => {
    const service = {
      ...catalogue[13],
      bookable: true,
      operational_status: "active" as const,
    };
    expect(eligible(service)).toBe(false);
    expect(
      eligible({
        ...service,
        qualification_verified_at: new Date().toISOString(),
      }),
    ).toBe(false);
    expect(
      eligible({
        ...service,
        qualification_verified_at: new Date().toISOString(),
        procedure_verified_at: new Date().toISOString(),
      }),
    ).toBe(true);
    expect(
      eligible({
        ...catalogue[15],
        bookable: true,
        price_cents: 2000,
        operational_status: "active",
        qualification_verified_at: new Date().toISOString(),
      }),
    ).toBe(false);
  });
});
describe("validation et confidentialité", () => {
  it("normalise les téléphones français et internationaux", () => {
    expect(phone.parse("06 12 34 56 78")).toBe("+33612345678");
    expect(phone.parse("0033612345678")).toBe("+33612345678");
    expect(phone.safeParse("abc").success).toBe(false);
  });
  it("refuse spam, consentement manquant et coordonnées invalides", () => {
    expect(
      contactSchema.safeParse({
        first_name: "A",
        email: "bad",
        subject: "abc",
        message: "test",
        consent: false,
      }).success,
    ).toBe(false);
    expect(
      bookingSchema.safeParse({
        service_id: catalogue[0].id,
        website: "spam",
        consent: true,
      }).success,
    ).toBe(false);
  });
  it("ne propose aucun lien WhatsApp inventé", () => {
    expect(whatsappLink("")).toBeNull();
    expect(whatsappLink("+33612345678", "Cils")).toContain(
      "https://wa.me/33612345678?text=",
    );
  });
  it("neutralise injection CSV et échappe les emails HTML", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });
});
describe("Europe/Paris et changements d’heure", () => {
  it("stocke UTC en hiver et été", () => {
    expect(parisInstant("2027-01-10", "10:00")).toBe(
      "2027-01-10T09:00:00.000Z",
    );
    expect(parisInstant("2027-07-10", "10:00")).toBe(
      "2027-07-10T08:00:00.000Z",
    );
  });
  it("refuse une heure locale inexistante au printemps", () => {
    expect(() => parisInstant("2027-03-28", "02:30")).toThrow();
  });
});
