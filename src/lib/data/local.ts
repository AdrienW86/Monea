import "server-only";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { addDays, format } from "date-fns";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { brand, resolveBrand } from "@/config/brand";
import { catalogue, eligible } from "@/lib/catalogue";
import { assertLocalDevelopment } from "./provider";
import { localMigrations } from "./local-schema";
import { commandSchema, bookingInputSchema } from "./commands";
import {
  DataError,
  type DataRepository,
  type Settings,
  type Category,
  type ManagedService,
  type Product,
  type Client,
  type Allocation,
  type ManagedBooking,
  type BookingLine,
  type LocalPayment,
  type Hours,
  type SpecialHours,
  type Notification,
  type Contact,
  type Audit,
  type Snapshot,
  type PublicBooking,
  type BookingInput,
  type Slot,
} from "./types";
type Table =
  | "categories"
  | "services"
  | "products"
  | "clients"
  | "bookings"
  | "payments"
  | "business_hours"
  | "special_hours"
  | "notifications"
  | "messages"
  | "audit"
  | "generated_days";
const now = () => new Date().toISOString();
const uid = () => randomUUID();
const defaults: Settings = {
  ...brand,
  slotStepMinutes: 30,
  defaultDurationMinutes: 60,
  planningStartHour: 8,
  planningEndHour: 21,
  localBookingEnabled: true,
};
export class LocalRepository implements DataRepository {
  readonly provider = "local" as const;
  readonly connection: DatabaseSync;
  constructor(
    filename = process.env.LOCAL_DATABASE_PATH ||
      ".local/data/monea-development.sqlite",
  ) {
    assertLocalDevelopment();
    if (filename !== ":memory:") {
      const root = path.resolve(".local");
      const target = path.resolve(/* turbopackIgnore: true */ filename);
      if (!target.startsWith(root + path.sep))
        throw Error("La base locale doit rester dans .local/.");
      mkdirSync(path.dirname(target), { recursive: true });
      filename = target;
    }
    this.connection = new DatabaseSync(filename);
    this.connection.exec(
      "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS _migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);",
    );
    this.transaction(() => {
      for (const migration of localMigrations) {
        if (
          !this.row(
            "SELECT version FROM _migrations WHERE version=?",
            migration.version,
          )
        ) {
          this.connection.exec(migration.sql);
          this.run(
            "INSERT INTO _migrations VALUES(?,?)",
            migration.version,
            now(),
          );
        }
      }
      if (!this.row("SELECT id FROM settings WHERE id=1")) {
        this.run("INSERT INTO settings VALUES(1,?)", JSON.stringify(defaults));
        const categories = new Map<string, string>();
        for (const service of catalogue) {
          if (!categories.has(service.category)) {
            const id = uid();
            categories.set(service.category, id);
            this.put("categories", {
              id,
              name: service.category,
              description: "",
              image: "",
              sort_order: categories.size,
              active: true,
              demo: false,
            });
          }
          this.putService({
            ...service,
            category_id: categories.get(service.category)!,
            demo: false,
          });
        }
      }
    });
  }
  close() {
    this.connection.close();
  }
  private run(sql: string, ...args: SQLInputValue[]) {
    return this.connection.prepare(sql).run(...args);
  }
  private row(sql: string, ...args: SQLInputValue[]) {
    return this.connection.prepare(sql).get(...args);
  }
  private rows(sql: string, ...args: SQLInputValue[]) {
    return this.connection.prepare(sql).all(...args);
  }
  private all<T>(table: Table): T[] {
    return this.rows(`SELECT data FROM ${table}`).map(
      (r) => JSON.parse(String(r.data)) as T,
    );
  }
  private one<T>(table: Table, id: string): T | null {
    const row = this.row(`SELECT data FROM ${table} WHERE id=?`, id);
    return row ? (JSON.parse(String(row.data)) as T) : null;
  }
  private required<T>(table: Table, id: string): T {
    const value = this.one<T>(table, id);
    if (!value) throw new DataError("Élément introuvable.");
    return value;
  }
  private put<T extends { id: string }>(
    table: Exclude<Table, "services" | "bookings" | "payments" | "products">,
    value: T,
  ) {
    this.run(
      `INSERT INTO ${table}(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`,
      value.id,
      JSON.stringify(value),
    );
  }
  private putService(value: ManagedService) {
    this.run(
      "INSERT INTO services(id,slug,category_id,data) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,category_id=excluded.category_id,data=excluded.data",
      value.id,
      value.slug,
      value.category_id,
      JSON.stringify(value),
    );
  }
  private putBooking(
    value: Omit<ManagedBooking, "lines" | "client" | "allocation" | "payment">,
  ) {
    const stored = { ...value } as Partial<ManagedBooking>;
    delete stored.lines;
    delete stored.client;
    delete stored.allocation;
    delete stored.payment;
    this.run(
      "INSERT INTO bookings(id,public_token,request_id,allocation_id,client_id,data) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,client_id=excluded.client_id",
      value.id,
      value.public_token,
      value.request_id,
      value.allocation_id,
      value.client_id,
      JSON.stringify(stored),
    );
  }
  private putPayment(p: LocalPayment) {
    this.run(
      "INSERT INTO payments(id,booking_id,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      p.id,
      p.booking_id,
      JSON.stringify(p),
    );
  }
  private transaction<T>(fn: () => T): T {
    this.connection.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.connection.exec("COMMIT");
      return result;
    } catch (e) {
      this.connection.exec("ROLLBACK");
      if (e instanceof Error && e.message.includes("ALLOCATION_CONFLICT"))
        throw new DataError(
          "Créneau indisponible. Un rendez-vous ou un blocage occupe cette période.",
        );
      throw e;
    }
  }
  private audit(
    actor: string,
    action: string,
    id: string,
    detail: Record<string, unknown> = {},
  ) {
    this.put("audit", {
      id: uid(),
      actor_id: actor,
      action,
      entity_id: id,
      detail,
      created_at: now(),
    } as Audit);
  }
  private notify(kind: string, id: string, title: string, message: string) {
    title = `${brand.name} · ${title}`;
    this.put("notifications", {
      id: uid(),
      kind,
      entity_id: id,
      title,
      message,
      status: "unread",
      transport: "local",
      created_at: now(),
    } as Notification);
  }
  private settingsSync(): Settings {
    return {
      ...defaults,
      ...resolveBrand(
        JSON.parse(
          String(this.row("SELECT data FROM settings WHERE id=1")!.data),
        ),
      ),
    };
  }
  async settings() {
    return this.settingsSync();
  }
  private servicesSync(): ManagedService[] {
    const categories = new Map(
      this.all<Category>("categories").map((c) => [c.id, c]),
    );
    return this.all<ManagedService>("services")
      .map((s) => ({
        ...s,
        category: categories.get(s.category_id)?.name || s.category,
        category_active: !!categories.get(s.category_id)?.active,
      }))
      .sort(
        (a, b) =>
          (categories.get(a.category_id)?.sort_order ?? 0) -
            (categories.get(b.category_id)?.sort_order ?? 0) ||
          a.sort_order - b.sort_order,
      );
  }
  async services() {
    return this.servicesSync();
  }
  async categories() {
    return this.all<Category>("categories").sort(
      (a, b) => a.sort_order - b.sort_order,
    );
  }
  private allocations() {
    return this.rows("SELECT * FROM time_allocations").map((row) => ({
      ...row,
      demo: !!row.demo,
    })) as unknown as Allocation[];
  }
  private bookingsSync(): ManagedBooking[] {
    const allocations = new Map(this.allocations().map((a) => [a.id, a]));
    const clients = new Map(this.all<Client>("clients").map((c) => [c.id, c]));
    const payments = new Map(
      this.all<LocalPayment>("payments").map((p) => [p.booking_id, p]),
    );
    return this.all<ManagedBooking>("bookings")
      .map((b) => ({
        ...b,
        allocation: allocations.get(b.allocation_id)!,
        client: clients.get(b.client_id)!,
        payment: payments.get(b.id) || null,
        lines: this.rows(
          "SELECT data FROM booking_lines WHERE booking_id=? ORDER BY position",
          b.id,
        ).map((r) => JSON.parse(String(r.data)) as BookingLine),
      }))
      .sort((a, b) =>
        a.allocation.start_at.localeCompare(b.allocation.start_at),
      );
  }
  private expire() {
    const expired = this.allocations().filter(
      (a) =>
        a.kind === "hold" &&
        a.state === "active" &&
        !!a.expires_at &&
        a.expires_at <= now(),
    );
    for (const a of expired) {
      this.run("UPDATE time_allocations SET state='expired' WHERE id=?", a.id);
      const b = this.all<ManagedBooking>("bookings").find(
        (b) => b.allocation_id === a.id,
      );
      if (b?.status === "pending") {
        this.putBooking({ ...b, status: "expired" });
        const p = this.all<LocalPayment>("payments").find(
          (p) => p.booking_id === b.id,
        );
        if (p?.status === "pending")
          this.putPayment({ ...p, status: "expired" });
      }
    }
  }
  private intervals(date: string) {
    const special = this.one<SpecialHours>("special_hours", date);
    if (special) return special.intervals;
    const weekday = new Date(date + "T12:00:00Z").getUTCDay();
    return this.all<Hours>("business_hours")
      .filter((h) => h.weekday === weekday)
      .map((h) => ({ opens: h.opens, closes: h.closes }));
  }
  private open(start: string, end: string) {
    const date = formatInTimeZone(start, "Europe/Paris", "yyyy-MM-dd");
    if (formatInTimeZone(end, "Europe/Paris", "yyyy-MM-dd") !== date)
      return false;
    const a = formatInTimeZone(start, "Europe/Paris", "HH:mm:ss");
    const b = formatInTimeZone(end, "Europe/Paris", "HH:mm:ss");
    return this.intervals(date).some(
      (i) => a >= i.opens + ":00" && b <= i.closes + ":00",
    );
  }
  private conflicts(start: string, end: string, ignore?: string) {
    return this.allocations().filter(
      (a) =>
        a.id !== ignore &&
        a.state === "active" &&
        a.start_at < end &&
        a.end_at > start,
    );
  }
  private checkInterval(start: string, end: string, ignore?: string) {
    const conflicts = this.conflicts(start, end, ignore);
    if (conflicts.length)
      throw new DataError(
        "Créneau indisponible. Résolvez les conflits avant de continuer.",
        conflicts,
      );
  }
  private availabilitySync(serviceId: string, date: string): Slot[] {
    const s = this.servicesSync().find((s) => s.id === serviceId);
    const cfg = this.settingsSync();
    if (!s || !eligible(s)) return [];
    const start = fromZonedTime(date + "T00:00:00", "Europe/Paris");
    const finish = fromZonedTime(
      format(addDays(new Date(date + "T12:00:00Z"), 1), "yyyy-MM-dd") +
        "T00:00:00",
      "Europe/Paris",
    );
    const minimum = Date.now() + cfg.noticeHours * 3600000;
    const maximum = Date.now() + cfg.horizonDays * 86400000;
    const slots: Slot[] = [];
    const intervals = this.intervals(date);
    if (!intervals.length) return slots;
    const occupied = this.allocations().filter((a) => a.state === "active");
    for (let t = start.getTime(); t < finish.getTime(); t += 60000) {
      const a = new Date(t).toISOString();
      const b = new Date(t + s.duration_minutes * 60000).toISOString();
      const clock = formatInTimeZone(a, "Europe/Paris", "HH:mm:ss");
      const minute = Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
      if (minute % cfg.slotStepMinutes !== 0) continue;
      const endClock = formatInTimeZone(
        b,
        "Europe/Paris",
        "yyyy-MM-dd HH:mm:ss",
      );
      if (
        endClock.slice(0, 10) === date &&
        intervals.some(
          (i) =>
            clock >= i.opens + ":00" && endClock.slice(11) <= i.closes + ":00",
        )
      )
        slots.push({
          start_at: a,
          end_at: b,
          available:
            t >= minimum &&
            t <= maximum &&
            !occupied.some((v) => v.start_at < b && v.end_at > a),
        });
    }
    return slots;
  }
  async availability(serviceId: string, date: string) {
    return this.transaction(() => {
      this.expire();
      return this.availabilitySync(serviceId, date);
    });
  }
  private projection(b: ManagedBooking): PublicBooking {
    return {
      id: b.id,
      public_token: b.public_token,
      service_name: b.service_name,
      price_cents: b.price_cents,
      status: b.status,
      start_at: b.allocation.start_at,
      end_at: b.allocation.end_at,
      payment_status: b.payment?.status || null,
      payment_provider: b.payment ? "mock" : null,
    };
  }
  async publicBooking(token: string) {
    return this.transaction(() => {
      this.expire();
      const b = this.bookingsSync().find((b) => b.public_token === token);
      return b ? this.projection(b) : null;
    });
  }
  private saveBooking(
    input: BookingInput,
    actor?: string,
    existingId?: string,
  ): PublicBooking {
    const parsed = bookingInputSchema.parse(input);
    this.expire();
    if (!existingId) {
      const duplicate = this.bookingsSync().find(
        (b) => b.request_id === parsed.request_id,
      );
      if (duplicate) return this.projection(duplicate);
    }
    const cfg = this.settingsSync();
    const previous = existingId
      ? this.bookingsSync().find((b) => b.id === existingId)
      : null;
    if (existingId && !previous)
      throw new DataError("Rendez-vous introuvable.");
    if (previous?.source === "online" && previous.status === "pending")
      throw new DataError(
        "Attendez le résultat du paiement provisoire avant modification.",
      );
    if (!actor && !cfg.localBookingEnabled)
      throw new DataError("Réservation locale désactivée.");
    if (!actor && parsed.client_id)
      throw new DataError("Coordonnées de la cliente requises.");
    const services = parsed.service_ids.map((id) => {
      const s = this.servicesSync().find((s) => s.id === id);
      const sameServices =
        previous &&
        previous.lines.map((l) => l.service_id).join("|") ===
          parsed.service_ids.join("|");
      if (!s || (!sameServices && !eligible(s)))
        throw new DataError(
          "Cette prestation n’est pas réservable : vérifiez son état et sa qualification.",
        );
      return s;
    });
    const unchanged =
      previous &&
      previous.lines.map((l) => l.service_id).join("|") ===
        parsed.service_ids.join("|");
    const lines: BookingLine[] = unchanged
      ? previous.lines
      : services.map((s) => ({
          id: uid(),
          service_id: s.id,
          service_name: s.name,
          price_cents: s.price_cents!,
          duration_minutes: s.duration_minutes,
        }));
    if (previous?.payment?.status === "mock_paid" && !unchanged)
      throw new DataError(
        "Les prestations d’un paiement accepté sont figées. Annulez et créez un nouveau rendez-vous, sans remboursement automatique.",
      );
    const duration = lines.reduce((n, s) => n + s.duration_minutes, 0);
    const price = lines.reduce((n, s) => n + s.price_cents, 0);
    const start = new Date(parsed.start_at).toISOString();
    const end = new Date(
      new Date(start).getTime() + duration * 60000,
    ).toISOString();
    const status = actor
      ? parsed.status || previous?.status || "confirmed"
      : "pending";
    if (
      previous?.source === "online" &&
      status !== "cancelled" &&
      (previous.payment?.status !== "mock_paid" || status === "pending")
    )
      throw new DataError(
        "La confirmation en ligne nécessite un paiement fictif accepté. Créez un rendez-vous manuel pour un règlement hors ligne.",
      );
    const sameInterval =
      previous &&
      previous.allocation.start_at === start &&
      previous.allocation.end_at === end;
    if (
      status !== "cancelled" &&
      !sameInterval &&
      (!this.open(start, end) ||
        new Date(start).getTime() <
          Date.now() - (previous ? 3650 : 0) * 86400000)
    )
      throw new DataError(
        "Créneau indisponible : horaire fermé ou date passée.",
      );
    if (!actor) {
      const t = new Date(start).getTime();
      const minute =
        Number(formatInTimeZone(start, "Europe/Paris", "H")) * 60 +
        Number(formatInTimeZone(start, "Europe/Paris", "mm"));
      const second = Number(formatInTimeZone(start, "Europe/Paris", "ss"));
      if (
        t < Date.now() + cfg.noticeHours * 3600000 ||
        t > Date.now() + cfg.horizonDays * 86400000 ||
        second !== 0 ||
        minute % cfg.slotStepMinutes !== 0
      )
        throw new DataError(
          "Créneau indisponible : préavis ou fenêtre de réservation.",
        );
    }
    if (status !== "cancelled")
      this.checkInterval(start, end, previous?.allocation_id);
    let customer: Client;
    if (parsed.client_id)
      customer = this.required<Client>("clients", parsed.client_id);
    else {
      const p = parsed.client!;
      const match = this.all<Client>("clients").find(
        (c) => c.email === p.email && c.phone === p.phone,
      );
      customer = match || {
        ...p,
        id: uid(),
        notes: "",
        demo: parsed.demo || false,
      };
      if (!match) this.put("clients", customer);
    }
    const allocationId = previous?.allocation_id || uid();
    const bookingId = previous?.id || uid();
    const allocation: Allocation = {
      id: allocationId,
      start_at: start,
      end_at: end,
      kind: actor
        ? previous?.allocation.kind === "booking"
          ? "booking"
          : "manual"
        : "hold",
      state: status === "cancelled" ? "cancelled" : "active",
      expires_at: actor
        ? null
        : new Date(Date.now() + cfg.holdMinutes * 60000).toISOString(),
      reason: "",
      series_id: null,
      demo: parsed.demo || false,
    };
    if (previous)
      this.run(
        "UPDATE time_allocations SET start_at=?,end_at=?,state=?,expires_at=?,kind=? WHERE id=?",
        start,
        end,
        allocation.state,
        allocation.expires_at,
        allocation.kind,
        allocationId,
      );
    else
      this.run(
        "INSERT INTO time_allocations(id,start_at,end_at,kind,state,expires_at,demo) VALUES(?,?,?,?,?,?,?)",
        allocationId,
        start,
        end,
        allocation.kind,
        allocation.state,
        allocation.expires_at,
        Number(allocation.demo),
      );
    const b = {
      id: bookingId,
      public_token: previous?.public_token || uid(),
      request_id: previous?.request_id || parsed.request_id,
      allocation_id: allocationId,
      client_id: customer.id,
      service_name: lines.map((s) => s.service_name).join(" + "),
      price_cents: price,
      duration_minutes: duration,
      status,
      source: previous?.source || (actor ? "manual" : "online"),
      offline_status:
        previous?.source === "online"
          ? previous.offline_status
          : actor
            ? parsed.offline_status || previous?.offline_status || "unpaid"
            : null,
      notes: parsed.notes ?? previous?.notes ?? "",
      created_at: previous?.created_at || now(),
      demo: previous?.demo || parsed.demo || false,
    } as const;
    this.putBooking(b);
    if (!unchanged) {
      this.run("DELETE FROM booking_lines WHERE booking_id=?", bookingId);
      lines.forEach((line, i) =>
        this.run(
          "INSERT INTO booking_lines VALUES(?,?,?,?,?)",
          line.id,
          bookingId,
          line.service_id,
          i,
          JSON.stringify(line),
        ),
      );
    }
    if (!actor)
      this.putPayment({
        id: uid(),
        booking_id: bookingId,
        provider: "mock",
        status: "pending",
        amount_cents: price,
        created_at: now(),
      });
    this.audit(
      actor || "public",
      previous ? "booking_updated" : "booking_created",
      bookingId,
      {
        before: previous
          ? {
              start: previous.allocation.start_at,
              status: previous.status,
              services: previous.lines,
            }
          : null,
        after: { start, status, lines },
      },
    );
    this.notify(
      previous ? "booking_updated" : "booking_created",
      bookingId,
      previous ? "Rendez-vous modifié" : "Nouvelle réservation",
      `${b.service_name} · ${formatInTimeZone(start, "Europe/Paris", "dd/MM/yyyy HH:mm")}`,
    );
    return this.projection({
      ...b,
      allocation,
      client: customer,
      lines,
      payment:
        this.all<LocalPayment>("payments").find(
          (p) => p.booking_id === bookingId,
        ) || null,
    });
  }
  async createBooking(input: BookingInput, actor?: string) {
    return this.transaction(() => this.saveBooking(input, actor));
  }
  async simulatePayment(
    token: string,
    result: "success" | "failed" | "expired",
  ) {
    return this.transaction(() => {
      this.expire();
      const b = this.bookingsSync().find((b) => b.public_token === token);
      if (!b || !b.payment) throw new DataError("Paiement fictif introuvable.");
      if (b.payment.status !== "pending") return this.projection(b);
      if (result === "success") {
        if (
          b.status === "cancelled" ||
          this.conflicts(
            b.allocation.start_at,
            b.allocation.end_at,
            b.allocation_id,
          ).length
        ) {
          this.putPayment({ ...b.payment, status: "reconciliation" });
          this.putBooking({ ...b, status: "reconciliation" });
          this.notify(
            "reconciliation",
            b.id,
            "Paiement fictif à vérifier",
            "Le créneau a été réattribué. Aucune double réservation.",
          );
        } else {
          this.run(
            "UPDATE time_allocations SET state='active',kind='booking',expires_at=NULL WHERE id=?",
            b.allocation_id,
          );
          this.putBooking({ ...b, status: "confirmed" });
          this.putPayment({ ...b.payment, status: "mock_paid" });
          this.notify(
            "mock_payment",
            b.id,
            "Paiement simulé accepté",
            `${b.service_name} — aucune somme encaissée.`,
          );
        }
      } else {
        this.run(
          "UPDATE time_allocations SET state='expired' WHERE id=?",
          b.allocation_id,
        );
        this.putBooking({ ...b, status: "expired" });
        this.putPayment({ ...b.payment, status: result });
        this.notify(
          "mock_payment",
          b.id,
          result === "failed"
            ? "Paiement simulé refusé"
            : "Paiement simulé expiré",
          "Créneau libéré, aucune somme encaissée.",
        );
      }
      this.audit("mock-provider", "mock_payment_" + result, b.id);
      return this.projection(
        this.bookingsSync().find((row) => row.id === b.id)!,
      );
    });
  }
  async storeContact(input: Omit<Contact, "id" | "status" | "created_at">) {
    this.transaction(() => {
      const id = uid();
      this.put("messages", {
        ...input,
        id,
        status: "new",
        created_at: now(),
      } as Contact);
      this.notify("contact", id, "Nouvelle demande de contact", input.subject);
    });
  }
  async snapshot(): Promise<Snapshot> {
    return this.transaction(() => {
      this.expire();
      return {
        provider: "local",
        settings: this.settingsSync(),
        categories: this.all<Category>("categories").sort(
          (a, b) => a.sort_order - b.sort_order,
        ),
        services: this.servicesSync(),
        products: this.all<Product>("products"),
        clients: this.all<Client>("clients"),
        bookings: this.bookingsSync(),
        allocations: this.allocations(),
        hours: this.all<Hours>("business_hours"),
        special: this.all<SpecialHours>("special_hours"),
        notifications: this.all<Notification>("notifications").sort((a, b) =>
          b.created_at.localeCompare(a.created_at),
        ),
        messages: this.all<Contact>("messages").sort((a, b) =>
          b.created_at.localeCompare(a.created_at),
        ),
        audit: this.all<Audit>("audit").sort((a, b) =>
          b.created_at.localeCompare(a.created_at),
        ),
      };
    });
  }
  async rateLimit(key: string, max: number) {
    return this.transaction(() => {
      const row = this.row("SELECT * FROM rate_limits WHERE id=?", key);
      const recent = row && Number(row.window_at) > Date.now() - 900000;
      const count = recent ? Number(row.count) + 1 : 1;
      this.run(
        "INSERT INTO rate_limits VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET window_at=excluded.window_at,count=excluded.count",
        key,
        recent ? Number(row.window_at) : Date.now(),
        count,
      );
      return count <= max;
    });
  }
  async mutate(command: unknown, actor: string): Promise<unknown> {
    const c = commandSchema.parse(command);
    return this.transaction(() => {
      this.expire();
      const d = c.data;
      let entity = "";
      let result: unknown = { ok: true };
      switch (c.action) {
        case "category_save": {
          const v = { ...c.data, id: c.data.id || uid(), demo: false };
          entity = v.id;
          this.put("categories", v);
          break;
        }
        case "category_delete": {
          entity = c.data.id;
          if (
            this.row(
              "SELECT id FROM services WHERE category_id=? UNION SELECT id FROM products WHERE category_id=?",
              entity,
              entity,
            )
          )
            throw new DataError(
              "Cette catégorie est utilisée par une prestation ou un produit. Masquez-la ou déplacez ses éléments.",
            );
          this.run("DELETE FROM categories WHERE id=?", entity);
          break;
        }
        case "service_save": {
          const v = c.data;
          const category = this.required<Category>("categories", v.category_id);
          const old = v.id
            ? this.required<ManagedService>("services", v.id)
            : null;
          if (
            old &&
            old.qualification_requirement !== v.qualification_requirement
          )
            throw new DataError(
              "L’exigence de qualification ne peut pas être abaissée depuis ce formulaire.",
            );
          if (
            v.qualification_requirement === "equipment" &&
            !old?.qualification_verified_at &&
            (v.bookable ||
              v.price_cents !== null ||
              v.operational_status !== "study")
          )
            throw new DataError(
              "Ce matériel doit rester à l’étude, sans tarif ni réservation.",
            );
          const service: ManagedService = {
            ...v,
            id: v.id || uid(),
            slug:
              old?.slug ||
              v.slug ||
              v.name
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "") +
                "-" +
                uid().slice(0, 6),
            category: category.name,
            qualification_verified_at: old?.qualification_verified_at || null,
            procedure_verified_at: old?.procedure_verified_at || null,
            image: v.image || null,
            demo: old?.demo || false,
          };
          entity = service.id;
          this.putService(service);
          break;
        }
        case "service_archive": {
          const v = this.required<ManagedService>("services", c.data.id);
          entity = v.id;
          this.putService({
            ...v,
            visibility: false,
            bookable: false,
            operational_status:
              v.operational_status === "study" ? "study" : "coming_soon",
          });
          break;
        }
        case "service_delete": {
          entity = c.data.id;
          this.required<ManagedService>("services", entity);
          if (
            this.row("SELECT id FROM booking_lines WHERE service_id=?", entity)
          )
            throw new DataError(
              "Cette prestation figure dans des rendez-vous. Archivez-la pour conserver leur historique.",
            );
          this.run("DELETE FROM services WHERE id=?", entity);
          break;
        }
        case "qualification": {
          const v = this.required<ManagedService>("services", c.data.id);
          entity = v.id;
          if (
            v.qualification_requirement === "equipment" ||
            v.qualification_requirement === "none"
          )
            throw new DataError(
              "Cette attestation ne correspond pas à cette prestation.",
            );
          if (
            c.data.attestation === "PROCÉDÉ VÉRIFIÉ" &&
            v.qualification_requirement !== "procedure"
          )
            throw new DataError("Procédé non concerné.");
          this.putService({
            ...v,
            ...(c.data.attestation === "QUALIFICATION VÉRIFIÉE"
              ? { qualification_verified_at: now() }
              : { procedure_verified_at: now() }),
          });
          break;
        }
        case "product_save": {
          const v = { ...c.data, id: c.data.id || uid(), demo: false };
          this.required<Category>("categories", v.category_id);
          entity = v.id;
          this.run(
            "INSERT INTO products VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET category_id=excluded.category_id,data=excluded.data",
            v.id,
            v.category_id,
            JSON.stringify(v),
          );
          break;
        }
        case "product_delete":
          entity = c.data.id;
          this.run("DELETE FROM products WHERE id=?", entity);
          break;
        case "client_save": {
          const v = {
            ...c.data,
            id: c.data.id || uid(),
            demo: c.data.id
              ? this.required<Client>("clients", c.data.id).demo
              : false,
          };
          entity = v.id;
          this.put("clients", v);
          break;
        }
        case "client_delete":
          entity = c.data.id;
          if (this.row("SELECT id FROM bookings WHERE client_id=?", entity))
            throw new DataError(
              "Cette cliente possède un historique de rendez-vous. Sa suppression est bloquée pour préserver cet historique.",
            );
          this.run("DELETE FROM clients WHERE id=?", entity);
          break;
        case "booking_save": {
          if (c.data.id && !c.data.confirmed)
            throw new DataError("Confirmez la modification du rendez-vous.");
          result = this.saveBooking(c.data, actor, c.data.id);
          entity = (result as PublicBooking).id;
          break;
        }
        case "booking_cancel": {
          const b = this.bookingsSync().find((b) => b.id === c.data.id);
          if (!b) throw new DataError("Rendez-vous introuvable.");
          entity = b.id;
          this.run(
            "UPDATE time_allocations SET state='cancelled' WHERE id=?",
            b.allocation_id,
          );
          this.putBooking({
            ...b,
            status: "cancelled",
            notes:
              b.notes +
              (c.data.reason ? "\nAnnulation : " + c.data.reason : ""),
          });
          this.notify(
            "cancellation",
            b.id,
            "Rendez-vous annulé",
            "Créneau libéré. Aucun remboursement automatique.",
          );
          break;
        }
        case "booking_delete": {
          const b = this.bookingsSync().find((b) => b.id === c.data.id);
          if (!b || b.status !== "cancelled" || b.payment)
            throw new DataError(
              "Seul un rendez-vous manuel annulé sans paiement en ligne peut être supprimé.",
            );
          entity = b.id;
          this.run("DELETE FROM bookings WHERE id=?", b.id);
          this.run("DELETE FROM time_allocations WHERE id=?", b.allocation_id);
          break;
        }
        case "block_save": {
          const v = c.data;
          const start = new Date(v.start_at).toISOString();
          const end = new Date(v.end_at).toISOString();
          const old = v.id
            ? this.allocations().find(
                (a) => a.id === v.id && a.kind === "block",
              )
            : null;
          if (v.id && !old) throw new DataError("Blocage introuvable.");
          const series = v.repeat === "weekly" ? uid() : null;
          const periods = [{ start, end }];
          if (series) {
            if (!v.repeat_until)
              throw new DataError("Choisissez la fin de la récurrence.");
            const startLocal = formatInTimeZone(
              start,
              "Europe/Paris",
              "yyyy-MM-dd'T'HH:mm:ss",
            );
            const endLocal = formatInTimeZone(
              end,
              "Europe/Paris",
              "yyyy-MM-dd'T'HH:mm:ss",
            );
            for (let i = 1; i <= 104; i++) {
              const a = format(
                addDays(new Date(startLocal), i * 7),
                "yyyy-MM-dd'T'HH:mm:ss",
              );
              if (a.slice(0, 10) > v.repeat_until) break;
              periods.push({
                start: fromZonedTime(a, "Europe/Paris").toISOString(),
                end: fromZonedTime(
                  format(
                    addDays(new Date(endLocal), i * 7),
                    "yyyy-MM-dd'T'HH:mm:ss",
                  ),
                  "Europe/Paris",
                ).toISOString(),
              });
            }
            if (
              v.repeat_until >
              format(addDays(new Date(startLocal), 728), "yyyy-MM-dd")
            )
              throw new DataError("Récurrence limitée à deux ans.");
          }
          for (const p of periods) this.checkInterval(p.start, p.end, old?.id);
          if (old)
            this.run(
              "UPDATE time_allocations SET state='cancelled' WHERE id=?",
              old.id,
            );
          for (const p of periods) {
            const id = uid();
            entity = id;
            this.run(
              "INSERT INTO time_allocations(id,start_at,end_at,kind,state,reason,series_id) VALUES(?,?,?,'block','active',?,?)",
              id,
              p.start,
              p.end,
              v.reason,
              series,
            );
          }
          this.notify(
            "block",
            entity,
            "Indisponibilité enregistrée",
            `${periods.length} période(s) bloquée(s).`,
          );
          break;
        }
        case "block_delete": {
          const old = this.allocations().find(
            (a) => a.id === c.data.id && a.kind === "block",
          );
          if (!old) throw new DataError("Blocage introuvable.");
          entity = old.id;
          if (c.data.series && old.series_id)
            this.run(
              "UPDATE time_allocations SET state='cancelled' WHERE kind='block' AND series_id=?",
              old.series_id,
            );
          else
            this.run(
              "UPDATE time_allocations SET state='cancelled' WHERE kind='block' AND id=?",
              old.id,
            );
          break;
        }
        case "hours_save":
          for (const h of c.data.hours)
            if (
              c.data.hours.some(
                (v) =>
                  v !== h &&
                  v.weekday === h.weekday &&
                  v.opens < h.closes &&
                  v.closes > h.opens,
              )
            )
              throw new DataError(
                "Deux plages d’ouverture se chevauchent. Vérifiez la pause et les horaires.",
              );
          this.run("DELETE FROM business_hours");
          for (const h of c.data.hours)
            this.put("business_hours", { ...h, id: uid() } as Hours);
          break;
        case "special_save":
          for (const h of c.data.intervals)
            if (
              c.data.intervals.some(
                (v) => v !== h && v.opens < h.closes && v.closes > h.opens,
              )
            )
              throw new DataError("Les plages exceptionnelles se chevauchent.");
          this.put("special_hours", { ...c.data, id: c.data.date });
          entity = c.data.date;
          break;
        case "special_delete":
          entity = c.data.date;
          this.run("DELETE FROM special_hours WHERE id=?", entity);
          break;
        case "settings_save":
          this.run(
            "UPDATE settings SET data=? WHERE id=1",
            JSON.stringify({ ...this.settingsSync(), ...c.data }),
          );
          break;
        case "generate": {
          const v = c.data;
          const days = Math.round(
            (new Date(v.end_date).getTime() -
              new Date(v.start_date).getTime()) /
              86400000,
          );
          if (days > 365) throw new DataError("Période limitée à 366 jours.");
          const output = [];
          for (let i = 0; i <= days; i++) {
            const date = format(
              addDays(new Date(v.start_date + "T12:00:00Z"), i),
              "yyyy-MM-dd",
            );
            const slots = this.availabilitySync(v.service_id, date);
            output.push({ date, slots });
            this.put("generated_days", {
              id: date + ":" + v.service_id,
              date,
              service_id: v.service_id,
              generated_at: now(),
              slots,
            });
          }
          result = {
            days: output,
            total: output.reduce(
              (n, d) => n + d.slots.filter((s) => s.available).length,
              0,
            ),
          };
          break;
        }
        case "contact_processed": {
          const v = this.required<Contact>("messages", c.data.id);
          entity = v.id;
          this.put("messages", { ...v, status: "processed" });
          break;
        }
        case "contact_delete":
          entity = c.data.id;
          this.run("DELETE FROM messages WHERE id=?", entity);
          break;
        case "notification_read": {
          const v = this.required<Notification>("notifications", c.data.id);
          entity = v.id;
          this.put("notifications", { ...v, status: "read" });
          break;
        }
        case "demo_load": {
          result = this.loadDemo(actor);
          break;
        }
      }
      this.audit(
        actor,
        c.action,
        entity,
        c.action === "qualification" ? (c.data as Record<string, unknown>) : {},
      );
      void d;
      return result;
    });
  }
  private loadDemo(actor: string) {
    // Recharge uniquement des lignes marquées fictives ; tout conflit avec une saisie locale réelle annule la transaction.
    const demoBookings = this.bookingsSync().filter((b) => b.demo);
    for (const b of demoBookings) {
      this.run("DELETE FROM payments WHERE booking_id=?", b.id);
      this.run("DELETE FROM bookings WHERE id=?", b.id);
      this.run("DELETE FROM time_allocations WHERE id=?", b.allocation_id);
    }
    for (const c of this.all<Client>("clients").filter((c) => c.demo)) {
      if (!this.row("SELECT id FROM bookings WHERE client_id=?", c.id))
        this.run("DELETE FROM clients WHERE id=?", c.id);
    }
    if (!this.all<Hours>("business_hours").length) {
      for (let day = 1; day <= 6; day++) {
        this.put("business_hours", {
          id: uid(),
          weekday: day,
          opens: "09:00",
          closes: "12:00",
        } as Hours);
        this.put("business_hours", {
          id: uid(),
          weekday: day,
          opens: "13:00",
          closes: "18:00",
        } as Hours);
      }
    }
    const cfg = this.settingsSync();
    this.run(
      "UPDATE settings SET data=? WHERE id=1",
      JSON.stringify({ ...cfg, localBookingEnabled: true, noticeHours: 1 }),
    );
    const s = this.servicesSync().find(eligible);
    if (!s) throw new DataError("Activez d’abord une prestation autorisée.");
    let count = 0;
    for (let offset = 1; offset <= 12 && count < 3; offset++) {
      const date = format(addDays(new Date(), offset), "yyyy-MM-dd");
      const slot = this.availabilitySync(s.id, date).find((s) => s.available);
      if (!slot) continue;
      this.saveBooking(
        {
          service_ids: [s.id],
          start_at: slot.start_at,
          request_id: uid(),
          client: {
            first_name: ["Camille", "Léa", "Sarah"][count] + " (fictive)",
            last_name: "Démonstration",
            email: `demo-${count}@example.invalid`,
            phone: `+3360000000${count}`,
          },
          offline_status: "unpaid",
          demo: true,
        },
        actor,
      );
      count++;
    }
    this.notify(
      "demo",
      "demo",
      "Données fictives chargées",
      `${count} rendez-vous fictifs. Horaires de démonstration uniquement si aucun horaire n’était défini.`,
    );
    return { ok: true, count };
  }
}
let cached: LocalRepository | undefined;
export function localRepository() {
  assertLocalDevelopment();
  return (cached ??= new LocalRepository());
}
