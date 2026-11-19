import { it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { LocalRepository } from "@/lib/data/local";
it("prépare un import catalogue sans écrasement, réexécutable, sans ouvrir les services réglementés", async () => {
  vi.stubEnv("NODE_ENV", "test");
  const local = new LocalRepository(":memory:");
  const pg = new PGlite();
  try {
    const root = path.resolve(".local", `catalogue-review-${randomUUID()}`);
    mkdirSync(path.join(root, "supabase/migrations"), { recursive: true });
    mkdirSync(path.join(root, "docs"));
    const data = await local.snapshot();
    // Exercise preservation of non-empty descriptions and individual images too.
    data.services[0].description =
      "Description à conserver : l'éclat\nseconde ligne";
    data.services[0].image = "/assets/catalogue-test.webp";
    writeFileSync(
      path.join(root, "export.json"),
      JSON.stringify({ schema_version: 2, source: "local", data }),
    );
    await pg.exec(
      "create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role bypassrls;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;",
    );
    for (const file of readdirSync("supabase/migrations")
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      copyFileSync(
        path.join("supabase/migrations", file),
        path.join(root, "supabase/migrations", file),
      );
      await pg.exec(
        readFileSync(path.join("supabase/migrations", file), "utf8"),
      );
    }
    await pg.exec(
      'update public.site_settings set value=\'{"bookingEnabled":false,"custom_marker":"preserve"}\';',
    );
    execFileSync(
      process.execPath,
      [
        path.resolve("scripts/prepare-supabase-catalogue.mjs"),
        path.join(root, "export.json"),
      ],
      { cwd: root, windowsHide: true, stdio: "pipe" },
    );
    const sql = readFileSync(path.join(root, "catalogue-review.sql"), "utf8");
    await pg.exec(sql);
    expect((await pg.query("select * from public.services")).rows).toHaveLength(
      0,
    );
    // COMMIT is used only in this in-memory PostgreSQL fixture, never remotely.
    const apply = sql.replace(/rollback;\s*$/, "commit;");
    await pg.exec(apply);
    await pg.exec(apply);
    expect(
      (await pg.query("select * from public.categories")).rows,
    ).toHaveLength(4);
    expect((await pg.query("select * from public.services")).rows).toHaveLength(
      23,
    );
    const payload = JSON.parse(
      readFileSync(path.join(root, "catalogue-payload.json"), "utf8"),
    );
    for (const table of ["categories", "services"]) {
      const stored = (
        await pg.query<Record<string, unknown>>(`select * from public.${table}`)
      ).rows;
      for (const incoming of payload[table]) {
        const row = stored.find((r) => r.id === incoming.id);
        expect(row).toBeDefined();
        for (const [key, value] of Object.entries(incoming))
          expect(row?.[key], `${table}.${key}`).toEqual(value);
      }
    }
    expect(
      (
        await pg.query(
          "select * from public.services where qualification_requirement='equipment' and (price_cents is not null or bookable or operational_status<>'study')",
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await pg.query(
          "select * from public.services where qualification_requirement<>'none' and bookable",
        )
      ).rows,
    ).toHaveLength(0);
    expect((await pg.query("select * from public.bookings")).rows).toHaveLength(
      0,
    );
    expect(
      (await pg.query("select value from public.site_settings")).rows[0],
    ).toEqual({ value: { bookingEnabled: false, custom_marker: "preserve" } });
    const id = data.services[0].id;
    await pg.query(
      "update public.services set description='Description distante à préserver' where id=$1",
      [id],
    );
    await expect(pg.exec(apply)).rejects.toThrow("Conflit de catalogue");
    await pg.exec("rollback");
    expect(
      (
        await pg.query("select description from public.services where id=$1", [
          id,
        ])
      ).rows[0],
    ).toEqual({ description: "Description distante à préserver" });
    // Different UUID with an existing slug must fail, never silently duplicate.
    data.services[0].id = randomUUID();
    writeFileSync(
      path.join(root, "export.json"),
      JSON.stringify({ schema_version: 2, source: "local", data }),
    );
    execFileSync(
      process.execPath,
      [
        path.resolve("scripts/prepare-supabase-catalogue.mjs"),
        path.join(root, "export.json"),
      ],
      { cwd: root, windowsHide: true, stdio: "pipe" },
    );
    const collision = readFileSync(
      path.join(root, "catalogue-review.sql"),
      "utf8",
    ).replace(/rollback;\s*$/, "commit;");
    await expect(pg.exec(collision)).rejects.toThrow();
    await pg.exec("rollback");
    expect((await pg.query("select * from public.services")).rows).toHaveLength(
      23,
    );
    expect(
      (
        await pg.query("select * from public.services where id=$1", [
          data.services[0].id,
        ])
      ).rows,
    ).toHaveLength(0);
  } finally {
    local.close();
    await pg.close();
    vi.unstubAllEnvs();
  }
});
