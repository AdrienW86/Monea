import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { blockPeriod } from "@/lib/booking/block-period";
import { parisInstant } from "@/lib/booking/time";
import { LocalRepository } from "@/lib/data/local";
import { NO_IMAGE } from "@/lib/media";
import { serviceVisual } from "@/config/editorial";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

let repo: LocalRepository;
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  repo = new LocalRepository(":memory:");
});
afterEach(() => {
  repo.close();
  vi.unstubAllEnvs();
});

it("prépare un stockage privé limité aux WebP sans élargir ses permissions", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(
      "create table public.services(image text constraint services_image_check check(image is null)); create schema storage; create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);",
    );
    const migration = readFileSync(
      "supabase/migrations/20261119121634_admin_image_visibility.sql",
      "utf8",
    );
    await pg.exec(migration);
    await pg.exec(migration);
    const bucket = await pg.query(
      "select id,public,file_size_limit,allowed_mime_types from storage.buckets",
    );
    expect(bucket.rows).toEqual([
      {
        id: "monea-media",
        public: false,
        file_size_limit: 5242880,
        allowed_mime_types: ["image/webp"],
      },
    ]);
    await pg.exec("insert into public.services values('none')");
    await expect(
      pg.exec(
        "insert into public.services values('https://untrusted.invalid/file.svg')",
      ),
    ).rejects.toThrow();
  } finally {
    await pg.close();
  }
});

it("ajoute, remplace, supprime et restaure les images sans rétablir une image supprimée", async () => {
  const category = (await repo.categories())[0];
  const service = (await repo.services())[0];
  for (const image of [
    "/images/beauty/spa-epilation-bras-v1.webp",
    "/images/beauty/spa-epilation-menton-v1.webp",
    NO_IMAGE,
    "",
  ]) {
    await repo.mutate(
      { action: "category_save", data: { ...category, image } },
      "test-admin",
    );
    await repo.mutate(
      { action: "service_save", data: { ...service, image } },
      "test-admin",
    );
    expect(
      (await repo.categories()).find((c) => c.id === category.id)?.image,
    ).toBe(image);
    const saved = (await repo.services()).find((s) => s.id === service.id)!;
    expect(saved.image).toBe(image || null);
    const visual = serviceVisual(saved.slug, saved.category, saved.image);
    if (image === NO_IMAGE) expect(visual).toBeNull();
    else
      expect(visual).toBe(
        image || serviceVisual(service.slug, service.category),
      );
  }
});

it("bloque une heure qui traverse minuit", () => {
  expect(blockPeriod("2026-11-30T23:30", "hour")).toEqual({
    start: "2026-11-30T23:30",
    end: "2026-12-01T00:30",
  });
});
it("couvre la journée entière même au passage à l’heure d’été", () => {
  const period = blockPeriod("2027-03-28T09:00", "day");
  expect(period).toEqual({
    start: "2027-03-28T00:00",
    end: "2027-03-29T00:00",
  });
  const instant = (s: string) => {
    const [day, time] = s.split("T");
    return new Date(parisInstant(day, time)).getTime();
  };
  expect(instant(period.end) - instant(period.start)).toBe(23 * 3600000);
});
it("bloque sept jours et le mois complet, y compris décembre et février bissextile", () => {
  expect(blockPeriod("2026-11-28T09:00", "week").end).toBe("2026-12-05T00:00");
  expect(blockPeriod("2026-12-31T09:00", "month")).toEqual({
    start: "2026-12-01T00:00",
    end: "2027-01-01T00:00",
  });
  expect(blockPeriod("2028-02-29T09:00", "month")).toEqual({
    start: "2028-02-01T00:00",
    end: "2028-03-01T00:00",
  });
});
