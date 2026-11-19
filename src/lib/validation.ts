import { z } from "zod";
const name = z.string().trim().min(1).max(80);
export const phone = z
  .string()
  .trim()
  .transform((v) =>
    v
      .replace(/[\s().-]/g, "")
      .replace(/^00/, "+")
      .replace(/^0(?=[1-9]\d{8}$)/, "+33"),
  )
  .pipe(
    z.string().regex(/^\+[1-9]\d{7,14}$/, "Téléphone international invalide."),
  );
export const clientSchema = z.object({
  first_name: name,
  last_name: name,
  email: z.email().trim().toLowerCase().max(254),
  phone,
});
export const bookingSchema = clientSchema.extend({
  service_id: z.uuid(),
  start_at: z.iso.datetime({ offset: true }),
  consent: z.literal(true),
  website: z.string().max(0).default(""),
  request_id: z.uuid(),
});
export const contactSchema = z.object({
  first_name: name,
  email: z.email().trim().toLowerCase().max(254),
  phone: z.union([phone, z.literal("")]).optional(),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(4000),
  consent: z.literal(true),
  website: z.string().max(0).default(""),
});
export const commercialContactSchema = z.object({
  address: z.string().trim().max(300),
  phone: z.union([phone, z.literal("")]),
  email: z.union([z.email(), z.literal("")]),
  whatsapp: z.union([phone, z.literal("")]),
  website: z.union([z.url().startsWith("https://"), z.literal("")]),
  instagram: z.union([
    z.url().startsWith("https://www.instagram.com/"),
    z.literal(""),
  ]),
  tiktok: z.union([
    z.url().startsWith("https://www.tiktok.com/"),
    z.literal(""),
  ]),
  snapchat: z.union([
    z.url().startsWith("https://www.snapchat.com/"),
    z.literal(""),
  ]),
});
export const settingsSchema = z
  .object({
    name: name,
    subtitle: name,
    slogan: name,
    city: name,
    website: commercialContactSchema.shape.website.optional(),
    address: z.string().max(300),
    phone: z.union([phone, z.literal("")]),
    email: z.union([z.email(), z.literal("")]),
    whatsapp: z.union([phone, z.literal("")]),
    instagram: z.union([
      z.url().startsWith("https://www.instagram.com/"),
      z.literal(""),
    ]),
    tiktok: z.union([
      z.url().startsWith("https://www.tiktok.com/"),
      z.literal(""),
    ]),
    snapchat: z.union([
      z.url().startsWith("https://www.snapchat.com/"),
      z.literal(""),
    ]),
    logo: z.string().regex(/^(|\/assets\/[\w./-]+\.(svg|png|webp))$/),
    heroImage: z.string().regex(/^(|\/assets\/[\w./-]+\.(png|jpg|webp))$/),
    legalName: z.string().max(200),
    legalAddress: z.string().max(300),
    registration: z.string().max(100),
    vatNumber: z.string().trim().max(50).default(""),
    publisher: z.string().max(200),
    host: z.string().max(200),
    mediator: z.string().max(300),
    legalReady: z.boolean(),
    privacyReady: z.boolean(),
    bookingEnabled: z.boolean(),
    pricesValidated: z.boolean(),
    retentionDays: z.number().int().min(30).max(3650),
    noticeHours: z.number().int().min(1).max(720),
    horizonDays: z.number().int().min(1).max(365),
    checkoutMinutes: z.number().int().min(30).max(60),
    holdMinutes: z.number().int().min(35).max(120),
    colors: z.object({
      night: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      cream: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      rose: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      coral: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    }),
  })
  .refine(
    (s) => s.holdMinutes >= s.checkoutMinutes + 5,
    "La rétention doit dépasser Checkout d’au moins 5 minutes.",
  )
  .refine(
    (s) =>
      !s.legalReady ||
      !!(
        s.legalName &&
        s.legalAddress &&
        s.registration &&
        s.publisher &&
        s.host &&
        s.mediator
      ),
    "Identité légale incomplète.",
  );
