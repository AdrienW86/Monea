import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { Worker } from "node:worker_threads";
import { mkdirSync, rmSync } from "node:fs";
import { addDays, format } from "date-fns";
import { LocalRepository } from "@/lib/data/local";
import { eligible } from "@/lib/catalogue";
import { parisInstant } from "@/lib/booking/time";
import { localAuthConfigured, mockPaymentsEnabled } from "@/lib/data/provider";
import type { PublicBooking } from "@/lib/data/types";
let repo: LocalRepository;
const person = {
  first_name: "Cliente",
  last_name: "Test confidentiel",
  email: "private@example.invalid",
  phone: "+33612345678",
};
const date = (days = 4) => format(addDays(new Date(), days), "yyyy-MM-dd");
const at = (days = 4, time = "09:00") => parisInstant(date(days), time);
const command = (action: string, data: unknown) =>
  repo.mutate({ action, data }, "test-admin");
const input = (service: string, days = 4, time = "09:00") => ({
  service_ids: [service],
  start_at: at(days, time),
  request_id: randomUUID(),
  client: person,
});
const service = async () => (await repo.services()).find(eligible)!;
const book = async (days = 4, time = "09:00") =>
  repo.createBooking(input((await service()).id, days, time), "test-admin");
async function edit(b: PublicBooking, changes: Record<string, unknown> = {}) {
  const row = (await repo.snapshot()).bookings.find((v) => v.id === b.id)!;
  return command("booking_save", {
    ...input(row.lines[0].service_id),
    id: b.id,
    client_id: row.client_id,
    confirmed: true,
    ...changes,
  });
}
beforeEach(async () => {
  vi.stubEnv("NODE_ENV", "test");
  repo = new LocalRepository(":memory:");
  await command("hours_save", {
    hours: Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      opens: "08:00",
      closes: "20:00",
    })),
  });
});
afterEach(() => {
  repo.close();
  vi.unstubAllEnvs();
});
describe("Gestion locale transactionnelle et persistante", () => {
  it("ouvre un équipement déjà confirmé lorsque son prix est renseigné", async () => {
    const s = (await repo.services()).find(
      (v) => v.qualification_requirement === "equipment",
    )!;
    const confirmed = {
      ...s,
      qualification_verified_at: new Date().toISOString(),
    };
    repo.connection
      .prepare("UPDATE services SET data=? WHERE id=?")
      .run(JSON.stringify(confirmed), s.id);
    await command("service_save", {
      ...confirmed,
      image: "",
      price_cents: 3500,
      bookable: true,
      operational_status: "active",
    });
    expect(eligible((await repo.services()).find((v) => v.id === s.id)!)).toBe(
      true,
    );
    expect((await repo.availability(s.id, date())).length).toBeGreaterThan(0);
  });
  it("masque une catégorie sans altérer le réglage propre de ses prestations et respecte son ordre", async () => {
    const s = await service();
    const c = (await repo.categories()).find((c) => c.id === s.category_id)!;
    await command("category_save", { ...c, active: false, sort_order: 999 });
    expect((await repo.services()).find((v) => v.id === s.id)).toMatchObject({
      visibility: true,
      category_active: false,
    });
    expect(await repo.availability(s.id, date())).toEqual([]);
    await command("category_save", { ...c, active: true, sort_order: 0 });
    expect(eligible((await repo.services()).find((v) => v.id === s.id)!)).toBe(
      true,
    );
    expect((await repo.services())[0].category_id).toBe(c.id);
  });
  it("deux workers SQLite concurrents : une seule allocation est validée", async () => {
    mkdirSync(".local/tests", { recursive: true });
    const file = ".local/tests/" + randomUUID() + ".sqlite";
    const db = new LocalRepository(file);
    db.close();
    const code = `const {parentPort,workerData}=require('node:worker_threads');const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(workerData.file);db.exec('PRAGMA busy_timeout=5000');parentPort.postMessage('ready');parentPort.once('message',()=>{let result;try{db.exec('BEGIN IMMEDIATE');db.prepare("INSERT INTO time_allocations(id,start_at,end_at,kind,state) VALUES(?,?,?,'hold','active')").run(workerData.id,workerData.start,workerData.end);db.exec('COMMIT');result='ok';}catch(e){try{db.exec('ROLLBACK')}catch{}result=e.message.includes('ALLOCATION_CONFLICT')?'conflict':e.message;}db.close();parentPort.postMessage(result);parentPort.close();});`;
    const workers = [0, 1].map(
      () =>
        new Worker(code, {
          eval: true,
          workerData: {
            file,
            id: randomUUID(),
            start: at(),
            end: at(4, "10:00"),
          },
        }),
    );
    try {
      await Promise.all(
        workers.map(
          (w) =>
            new Promise<void>((resolve, reject) => {
              w.once("error", reject);
              w.once("message", () => resolve());
            }),
        ),
      );
      const results = workers.map(
        (w) =>
          new Promise<string>((resolve, reject) => {
            w.once("error", reject);
            w.once("message", resolve);
          }),
      );
      workers.forEach((w) => w.postMessage("go"));
      expect((await Promise.all(results)).sort()).toEqual(["conflict", "ok"]);
    } finally {
      await Promise.all(workers.map((w) => w.terminate()));
      for (const suffix of ["", "-wal", "-shm"])
        rmSync(file + suffix, { force: true });
    }
  });
  it("crée, modifie, masque et supprime une catégorie non référencée", async () => {
    await command("category_save", {
      name: "Nouveauté",
      description: "Une description",
      image: "",
      sort_order: 12,
      active: true,
    });
    let c = (await repo.categories()).find((c) => c.name === "Nouveauté")!;
    await command("category_save", { ...c, name: "Renommée", active: false });
    c = (await repo.categories()).find((v) => v.id === c.id)!;
    expect(c.name).toBe("Renommée");
    expect(c.active).toBe(false);
    await command("category_delete", { id: c.id, confirmed: true });
    expect((await repo.categories()).some((v) => v.id === c.id)).toBe(false);
  });
  it("crée une prestation, modifie prix et durée sans modifier une ligne historique", async () => {
    const category = (await repo.categories())[0];
    const data = {
      name: "Soin test libre",
      description: "Soin",
      category_id: category.id,
      price_cents: 2000,
      duration_minutes: 60,
      image: "",
      sort_order: 99,
      visibility: true,
      bookable: true,
      operational_status: "active",
      qualification_requirement: "none",
    };
    await command("service_save", data);
    const s = (await repo.services()).find((s) => s.name === data.name)!;
    const b = await repo.createBooking(input(s.id), "admin");
    await expect(
      command("service_delete", { id: s.id, confirmed: true }),
    ).rejects.toThrow("historique");
    await command("service_save", {
      ...data,
      id: s.id,
      price_cents: 3500,
      duration_minutes: 90,
      name: "Nouveau nom",
    });
    const row = (await repo.snapshot()).bookings.find((v) => v.id === b.id)!;
    expect(row.lines[0]).toMatchObject({
      service_name: data.name,
      price_cents: 2000,
      duration_minutes: 60,
    });
    expect((await repo.services()).find((v) => v.id === s.id)).toMatchObject({
      price_cents: 3500,
      duration_minutes: 90,
    });
    await edit(b, { start_at: at(5) });
    expect((await repo.publicBooking(b.public_token))?.price_cents).toBe(2000);
  });
  it("enregistre un rendez-vous manuel et règlement hors ligne distinct", async () => {
    const b = await repo.createBooking(
      { ...input((await service()).id), offline_status: "paid_offline" },
      "admin",
    );
    const row = (await repo.snapshot()).bookings.find((v) => v.id === b.id)!;
    expect(row).toMatchObject({
      source: "manual",
      offline_status: "paid_offline",
      payment: null,
      status: "confirmed",
    });
  });
  it("refuse le chevauchement manuel et accepte deux intervalles contigus", async () => {
    await book();
    await expect(book(4, "09:30")).rejects.toThrow("Crén");
    await expect(book(4, "10:00")).resolves.toMatchObject({
      status: "confirmed",
    });
    expect((await repo.snapshot()).clients).toHaveLength(1);
  });
  it("annule, libère et conserve l’historique sans inventer de remboursement", async () => {
    const b = await book();
    await command("booking_cancel", {
      id: b.id,
      confirmed: true,
      reason: "Demande cliente",
    });
    expect(
      (await repo.availability((await service()).id, date())).find(
        (s) => s.start_at === at(),
      )?.available,
    ).toBe(true);
    await book();
    expect(
      (await repo.snapshot()).audit.some((a) => a.action === "booking_cancel"),
    ).toBe(true);
  });
  it("déplace un rendez-vous et restaure l’ancien état en cas de conflit", async () => {
    const b = await book();
    await book(4, "11:00");
    await expect(edit(b, { start_at: at(4, "11:00") })).rejects.toThrow("Crén");
    expect((await repo.publicBooking(b.public_token))?.start_at).toBe(at());
    await edit(b, { start_at: at(4, "14:00") });
    expect((await repo.publicBooking(b.public_token))?.start_at).toBe(
      at(4, "14:00"),
    );
  });
  it("protège la durée cumulée de plusieurs prestations", async () => {
    const services = (await repo.services()).filter(eligible).slice(0, 2);
    const b = await repo.createBooking(
      { ...input(services[0].id), service_ids: services.map((s) => s.id) },
      "admin",
    );
    expect(
      (new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 60000,
    ).toBe(120);
    await expect(book(4, "10:00")).rejects.toThrow("Crén");
  });
  it.each([1, 7, 31])(
    "bloque une période de %i jours et la libère immédiatement",
    async (length) => {
      await command("block_save", {
        start_at: at(4, "00:00"),
        end_at: at(4 + length, "00:00"),
        reason: "Motif strictement privé",
      });
      expect(
        (await repo.availability((await service()).id, date())).every(
          (s) => !s.available,
        ),
      ).toBe(true);
      const block = (await repo.snapshot()).allocations.find(
        (a) => a.kind === "block",
      )!;
      await command("block_delete", { id: block.id, confirmed: true });
      expect(
        (await repo.availability((await service()).id, date())).some(
          (s) => s.available,
        ),
      ).toBe(true);
    },
  );
  it("refuse un blocage contenant un rendez-vous et annule toute la récurrence", async () => {
    await book(11);
    await expect(
      command("block_save", {
        start_at: at(4, "09:00"),
        end_at: at(4, "10:00"),
        reason: "Réunion",
        repeat: "weekly",
        repeat_until: date(18),
      }),
    ).rejects.toThrow("Crén");
    expect(
      (await repo.snapshot()).allocations.filter((a) => a.kind === "block"),
    ).toHaveLength(0);
  });
  it("régénère et respecte pauses et fermeture exceptionnelle sans perte", async () => {
    const b = await book();
    await command("hours_save", {
      hours: Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        opens: "08:00",
        closes: "12:00",
      })),
    });
    await command("special_save", {
      date: date(5),
      reason: "Privé",
      intervals: [],
    });
    await command("generate", {
      start_date: date(),
      end_date: date(5),
      service_id: (await service()).id,
    });
    expect((await repo.publicBooking(b.public_token))?.status).toBe(
      "confirmed",
    );
    expect(await repo.availability((await service()).id, date(5))).toEqual([]);
  });
  it("crée un hold public, refuse un concurrent puis confirme une seule fois le paiement fictif", async () => {
    const values = input((await service()).id);
    const b = await repo.createBooking(values);
    expect(b.status).toBe("pending");
    await expect(book()).rejects.toThrow("Crén");
    expect((await repo.createBooking(values)).id).toBe(b.id);
    await repo.simulatePayment(b.public_token, "success");
    await repo.simulatePayment(b.public_token, "success");
    expect(await repo.publicBooking(b.public_token)).toMatchObject({
      status: "confirmed",
      payment_status: "mock_paid",
      payment_provider: "mock",
    });
  });
  it.each(["failed", "expired"] as const)(
    "libère le hold après paiement %s",
    async (result) => {
      const b = await repo.createBooking(input((await service()).id));
      await repo.simulatePayment(b.public_token, result);
      expect((await repo.publicBooking(b.public_token))?.payment_status).toBe(
        result,
      );
      await expect(book()).resolves.toMatchObject({ status: "confirmed" });
    },
  );
  it("ne divulgue ni cliente ni notes ni motifs dans les projections publiques", async () => {
    const b = await book();
    const result = JSON.stringify({
      slots: await repo.availability((await service()).id, date()),
      booking: await repo.publicBooking(b.public_token),
    });
    for (const secret of [
      person.email,
      person.last_name,
      "client_id",
      "offline_status",
      "reason",
      "notes",
    ])
      expect(result).not.toContain(secret);
  });
  it("conserve les restrictions professionnelles et interdit de les abaisser", async () => {
    const s = (await repo.services()).find(
      (s) => s.qualification_requirement === "professional",
    )!;
    await command("service_save", {
      ...s,
      image: s.image || "",
      bookable: true,
      operational_status: "active",
    });
    expect(await repo.availability(s.id, date())).toEqual([]);
    await expect(repo.createBooking(input(s.id), "admin")).rejects.toThrow(
      "qualification",
    );
    await expect(
      command("service_save", {
        ...s,
        image: "",
        qualification_requirement: "none",
      }),
    ).rejects.toThrow("qualification");
  });
  it("persiste après fermeture/réouverture et sérialise deux connexions SQLite", async () => {
    mkdirSync(".local/tests", { recursive: true });
    const file = ".local/tests/" + randomUUID() + ".sqlite";
    const db = new LocalRepository(file);
    let db2: LocalRepository | undefined;
    try {
      await db.mutate(
        {
          action: "hours_save",
          data: {
            hours: Array.from({ length: 7 }, (_, weekday) => ({
              weekday,
              opens: "08:00",
              closes: "20:00",
            })),
          },
        },
        "admin",
      );
      const s = (await db.services()).find(eligible)!;
      const b = await db.createBooking(input(s.id), "admin");
      db.close();
      db2 = new LocalRepository(file);
      expect((await db2.publicBooking(b.public_token))?.status).toBe(
        "confirmed",
      );
      await expect(db2.createBooking(input(s.id), "admin")).rejects.toThrow(
        "Crén",
      );
    } finally {
      db2?.close();
      for (const suffix of ["", "-wal", "-shm"])
        rmSync(file + suffix, { force: true });
    }
  });
  it("les triggers SQL refusent directement insert et déplacement concurrents", async () => {
    await book();
    const sql =
      "INSERT INTO time_allocations(id,start_at,end_at,kind,state) VALUES(?,?,?,'block','active')";
    expect(() =>
      repo.connection.prepare(sql).run(randomUUID(), at(), at(4, "10:00")),
    ).toThrow("ALLOCATION_CONFLICT");
  });
  it("gère les changements d’heure Paris : 23 h et 25 h sans horaires inexistants", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2027-03-25T00:00:00Z"));
      await command("hours_save", {
        hours: [{ weekday: 0, opens: "01:00", closes: "04:00" }],
      });
      const spring = await repo.availability(
        (await service()).id,
        "2027-03-28",
      );
      expect(spring.map((v) => v.start_at)).not.toContain(
        "2027-03-28T01:30:00.000Z",
      );
      expect(spring.length).toBeGreaterThan(0);
      vi.setSystemTime(new Date("2027-10-28T00:00:00Z"));
      expect(
        (await repo.availability((await service()).id, "2027-10-31")).filter(
          (s) => s.available,
        ).length,
      ).toBeGreaterThan(spring.length);
    } finally {
      vi.useRealTimers();
    }
  });
  it("interdit local, mock et authentification locale en production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATA_PROVIDER", "local");
    vi.stubEnv("PAYMENT_PROVIDER", "mock");
    expect(localAuthConfigured()).toBe(false);
    expect(mockPaymentsEnabled()).toBe(false);
    expect(() => new LocalRepository(":memory:")).toThrow("interdit");
  });
  it("sépare produits et planning et protège la catégorie référencée", async () => {
    const category = (await repo.categories())[0];
    await command("product_save", {
      name: "Crème",
      description: "Produit sans rendez-vous",
      price_cents: 1500,
      image: "",
      category_id: category.id,
      status: "active",
      stock: 3,
    });
    expect((await repo.snapshot()).products).toHaveLength(1);
    expect((await repo.snapshot()).allocations).toHaveLength(0);
    await expect(
      command("category_delete", { id: category.id, confirmed: true }),
    ).rejects.toThrow("utilisée");
  });
  it("ne charge le jeu fictif que sur action et préserve les saisies manuelles", async () => {
    expect((await repo.snapshot()).clients).toHaveLength(0);
    const b = await book();
    await command("demo_load", { confirmed: true });
    await command("demo_load", { confirmed: true });
    expect((await repo.snapshot()).bookings.filter((b) => b.demo)).toHaveLength(
      3,
    );
    expect((await repo.publicBooking(b.public_token))?.status).toBe(
      "confirmed",
    );
  });
});
