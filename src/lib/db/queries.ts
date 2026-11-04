import "server-only";
import { brand, type Brand } from "@/config/brand";
import { catalogue, type Service } from "@/lib/catalogue";
import { dbConfigured } from "./server";
import { stripeKeyAllowed } from "@/lib/payments/stripe";
import { stripePaymentsEnabled } from "@/lib/payments/provider.mjs";
import { isLocalProvider } from "@/lib/data/provider";
import { localRepository } from "@/lib/data/local";
import { repository } from "@/lib/data/repository";
export async function getSettings(): Promise<Brand> {
  if (isLocalProvider()) return localRepository().settings();
  if (!dbConfigured()) return brand;
  return repository().settings();
}
export async function getServices(): Promise<Service[]> {
  if (isLocalProvider()) {
    const repository = localRepository();
    const [services, categories] = await Promise.all([
      repository.services(),
      repository.categories(),
    ]);
    return services
      .filter((s) => s.visibility && s.category_active !== false)
      .map((s) => ({
        ...s,
        image:
          s.image ||
          categories.find((c) => c.id === s.category_id)?.image ||
          null,
      }));
  }
  if (!dbConfigured()) return catalogue;
  const repo = repository();
  const [services, categories] = await Promise.all([
    repo.services(),
    repo.categories(),
  ]);
  return services
    .filter((s) => s.visibility && s.category_active !== false)
    .map((s) => ({
      ...s,
      image:
        s.image ||
        categories.find((c) => c.id === s.category_id)?.image ||
        null,
    }));
}
export function integrationStatus() {
  return {
    Supabase: dbConfigured(),
    Stripe:
      stripePaymentsEnabled() &&
      stripeKeyAllowed() &&
      !!process.env.STRIPE_WEBHOOK_SECRET &&
      !!process.env.NEXT_PUBLIC_APP_URL,
    WhatsApp: !!(
      process.env.WHATSAPP_ACCESS_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID &&
      process.env.WHATSAPP_ADMIN_TO &&
      process.env.WHATSAPP_TEMPLATE_NAME &&
      process.env.WHATSAPP_TEMPLATE_LANG &&
      process.env.META_GRAPH_API_VERSION
    ),
    Email: !!(
      process.env.RESEND_API_KEY &&
      process.env.EMAIL_FROM &&
      process.env.ADMIN_EMAIL
    ),
    "Envois externes autorisés":
      process.env.ENABLE_EXTERNAL_NOTIFICATIONS === "true",
  };
}
