import { z } from "zod";
import { commercialContactSchema } from "@/lib/validation";
import { clientSchema } from "@/lib/validation";
const id = z.uuid();
const text = z.string().trim().max(4000);
const name = z.string().trim().min(1).max(150);
const image = z
  .string()
  .regex(/^(|\/(?:assets|images\/beauty)\/[\w./-]+\.(?:svg|png|jpg|webp))$/);
const interval = z
  .object({
    opens: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    closes: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  })
  .refine((v) => v.opens < v.closes, "L’heure de fin doit suivre l’ouverture.");
export const bookingInputSchema = z
  .object({
    service_ids: z.array(id).min(1).max(8),
    start_at: z.iso.datetime({ offset: true }),
    request_id: id,
    client_id: id.optional(),
    client: clientSchema.optional(),
    offline_status: z.enum(["paid_offline", "unpaid"]).optional(),
    status: z
      .enum(["pending", "confirmed", "completed", "cancelled", "no_show"])
      .optional(),
    notes: text.optional(),
    demo: z.boolean().optional(),
  })
  .refine(
    (v) => !!v.client_id || !!v.client,
    "Choisissez ou renseignez une cliente.",
  );
export const commandSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("category_save"),
    data: z.object({
      id: id.optional(),
      name,
      description: text,
      image,
      sort_order: z.number().int().min(0).max(1000),
      active: z.boolean(),
    }),
  }),
  z.object({
    action: z.literal("category_delete"),
    data: z.object({ id, confirmed: z.literal(true) }),
  }),
  z.object({
    action: z.literal("service_save"),
    data: z.object({
      id: id.optional(),
      name,
      slug: z
        .string()
        .regex(/^[a-z0-9-]+$/)
        .optional(),
      description: text,
      category_id: id,
      price_cents: z.number().int().min(100).max(1000000).nullable(),
      duration_minutes: z.number().int().min(15).max(480),
      image,
      sort_order: z.number().int().min(0).max(1000),
      visibility: z.boolean(),
      bookable: z.boolean(),
      operational_status: z.enum(["active", "coming_soon", "study"]),
      qualification_requirement: z.enum([
        "none",
        "professional",
        "procedure",
        "equipment",
      ]),
    }),
  }),
  z.object({
    action: z.literal("service_delete"),
    data: z.object({ id, confirmed: z.literal(true) }),
  }),
  z.object({
    action: z.literal("service_archive"),
    data: z.object({ id, confirmed: z.literal(true) }),
  }),
  z.object({
    action: z.literal("qualification"),
    data: z.object({
      id,
      evidence: z.string().trim().min(10).max(1000),
      attestation: z.enum(["QUALIFICATION VÉRIFIÉE", "PROCÉDÉ VÉRIFIÉ"]),
    }),
  }),
  z.object({
    action: z.literal("product_save"),
    data: z.object({
      id: id.optional(),
      name,
      description: text,
      category_id: id,
      price_cents: z.number().int().min(0).max(1000000),
      image,
      status: z.enum(["active", "archived"]),
      stock: z.number().int().min(0).nullable(),
    }),
  }),
  z.object({
    action: z.literal("product_delete"),
    data: z.object({ id, confirmed: z.literal(true) }),
  }),
  z.object({
    action: z.literal("client_save"),
    data: clientSchema.extend({ id: id.optional(), notes: text }),
  }),
  z.object({
    action: z.literal("client_delete"),
    data: z.object({ id, confirmed: z.literal(true) }),
  }),
  z.object({
    action: z.literal("booking_save"),
    data: bookingInputSchema.and(
      z.object({ id: id.optional(), confirmed: z.boolean().optional() }),
    ),
  }),
  z.object({
    action: z.literal("booking_cancel"),
    data: z.object({ id, reason: text, confirmed: z.literal(true) }),
  }),
  z.object({
    action: z.literal("booking_delete"),
    data: z.object({ id, confirmed: z.literal(true) }),
  }),
  z.object({
    action: z.literal("block_save"),
    data: z
      .object({
        id: id.optional(),
        start_at: z.iso.datetime({ offset: true }),
        end_at: z.iso.datetime({ offset: true }),
        reason: text,
        repeat: z.enum(["none", "weekly"]).default("none"),
        repeat_until: z.iso.date().optional(),
      })
      .refine(
        (v) => new Date(v.start_at) < new Date(v.end_at),
        "Période invalide.",
      ),
  }),
  z.object({
    action: z.literal("block_delete"),
    data: z.object({
      id,
      series: z.boolean().default(false),
      confirmed: z.literal(true),
    }),
  }),
  z.object({
    action: z.literal("hours_save"),
    data: z.object({
      hours: z
        .array(
          interval.and(z.object({ weekday: z.number().int().min(0).max(6) })),
        )
        .max(35),
    }),
  }),
  z.object({
    action: z.literal("special_save"),
    data: z.object({
      date: z.iso.date(),
      intervals: z.array(interval).max(8),
      reason: text,
    }),
  }),
  z.object({
    action: z.literal("special_delete"),
    data: z.object({ date: z.iso.date() }),
  }),
  z.object({
    action: z.literal("generate"),
    data: z
      .object({
        start_date: z.iso.date(),
        end_date: z.iso.date(),
        service_id: id,
      })
      .refine((v) => v.start_date <= v.end_date),
  }),
  z.object({
    action: z.literal("settings_save"),
    data: z
      .object({
        name,
        subtitle: name,
        slogan: name,
        city: name,
        ...commercialContactSchema.partial().shape,
        slotStepMinutes: z.number().int().min(5).max(120),
        defaultDurationMinutes: z.number().int().min(15).max(480),
        noticeHours: z.number().int().min(0).max(720),
        horizonDays: z.number().int().min(1).max(365),
        planningStartHour: z.number().int().min(0).max(22),
        planningEndHour: z.number().int().min(1).max(24),
        localBookingEnabled: z.boolean(),
      })
      .refine((v) => v.planningStartHour < v.planningEndHour),
  }),
  z.object({ action: z.literal("contact_processed"), data: z.object({ id }) }),
  z.object({
    action: z.literal("contact_delete"),
    data: z.object({ id, confirmed: z.literal(true) }),
  }),
  z.object({ action: z.literal("notification_read"), data: z.object({ id }) }),
  z.object({
    action: z.literal("demo_load"),
    data: z.object({ confirmed: z.literal(true) }),
  }),
]);
export type AdminCommand = z.infer<typeof commandSchema>;
