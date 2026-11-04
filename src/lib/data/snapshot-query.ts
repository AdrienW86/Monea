import { z } from "zod";
export const snapshotQuerySchema = z
  .object({
    section: z
      .enum([
        "all",
        "",
        "planning",
        "rendez-vous",
        "clientes",
        "catalogue",
        "categories",
        "indisponibilites",
        "horaires",
        "notifications",
        "messages",
        "parametres",
        "lookup",
      ])
      .optional(),
    page: z.coerce.number().int().min(0).max(100000).default(0),
    search: z.string().max(150).default(""),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    clientId: z.uuid().optional(),
    bookingId: z.uuid().optional(),
    status: z
      .enum([
        "",
        "pending",
        "confirmed",
        "cancelled",
        "expired",
        "completed",
        "no_show",
        "reconciliation",
      ])
      .optional(),
    date: z.iso.date().optional(),
  })
  .refine(
    (v) =>
      !v.from ||
      !v.to ||
      (v.from <= v.to &&
        (new Date(v.to).getTime() - new Date(v.from).getTime()) / 86400000 <=
          93),
    "Période limitée à 94 jours.",
  );
