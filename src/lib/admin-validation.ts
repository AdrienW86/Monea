import { z } from "zod";
import { clientSchema, settingsSchema } from "./validation";
const id = z.uuid();
const instant = z.iso.datetime({ offset: true });
const text = z.string().trim().max(4000);
const interval = z
  .object({
    opens: z.string().regex(/^\d{2}:\d{2}$/),
    closes: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .refine((i) => i.opens < i.closes);
export const adminSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("manual"),
    data: clientSchema.extend({
      service_id: id,
      start_at: instant,
      offline_status: z.enum(["paid_offline", "unpaid"]),
      request_id: id,
    }),
  }),
  z.object({
    action: z.literal("block"),
    data: z
      .object({ start_at: instant, end_at: instant, reason: text })
      .refine((v) => new Date(v.start_at) < new Date(v.end_at)),
  }),
  z.object({ action: z.literal("unblock"), data: z.object({ id }) }),
  z.object({
    action: z.literal("cancel"),
    data: z.object({ id, reason: text, confirmed: z.literal(true) }),
  }),
  z.object({
    action: z.literal("move"),
    data: z.object({ id, start_at: instant, confirmed: z.literal(true) }),
  }),
  z.object({ action: z.literal("notes"), data: z.object({ id, notes: text }) }),
  z.object({
    action: z.literal("service"),
    data: z.object({
      id,
      name: z.string().min(1).max(150),
      category: z.string().min(1).max(100),
      description: text,
      price_cents: z.number().int().min(100).max(1000000).nullable(),
      duration_minutes: z.number().int().min(15).max(480),
      sort_order: z.number().int().min(0).max(1000),
      operational_status: z.enum(["active", "coming_soon", "study"]),
      bookable: z.boolean(),
      visibility: z.boolean(),
      image: z.string().regex(/^(|\/assets\/[\w./-]+\.(png|jpg|webp))$/),
    }),
  }),
  z.object({
    action: z.literal("verify_qualification"),
    data: z.object({
      id,
      attestation: z.literal("QUALIFICATION VÉRIFIÉE"),
      evidence: z.string().min(10).max(1000),
    }),
  }),
  z.object({
    action: z.literal("verify_procedure"),
    data: z.object({
      id,
      attestation: z.literal("PROCÉDÉ VÉRIFIÉ"),
      evidence: z.string().min(10).max(1000),
    }),
  }),
  z.object({
    action: z.literal("hours"),
    data: z.object({
      hours: z
        .array(
          interval.and(z.object({ weekday: z.number().int().min(0).max(6) })),
        )
        .max(28),
    }),
  }),
  z.object({
    action: z.literal("special_hours"),
    data: z.object({
      date: z.iso.date(),
      intervals: z.array(interval).max(5),
      reason: text,
    }),
  }),
  z.object({
    action: z.literal("delete_special_hours"),
    data: z.object({ date: z.iso.date() }),
  }),
  z.object({ action: z.literal("settings"), data: settingsSchema }),
  z.object({ action: z.literal("process_contact"), data: z.object({ id }) }),
  z.object({ action: z.literal("retry_notification"), data: z.object({ id }) }),
  z.object({
    action: z.literal("refund"),
    data: z.object({ id, confirmed: z.literal(true) }),
  }),
  z.object({
    action: z.literal("anonymize"),
    data: z.object({ id, confirmed: z.literal(true) }),
  }),
  z.object({ action: z.literal("run_outbox"), data: z.object({}) }),
]);
