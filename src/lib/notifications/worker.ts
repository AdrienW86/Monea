import "server-only";
import { brand } from "@/config/brand";
import { isLocalProvider } from "@/lib/data/provider";
import { db } from "@/lib/db/server";
import { integrationStatus } from "@/lib/db/queries";
import { localDate } from "@/lib/booking/time";
export function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
export async function processOutbox() {
  if (isLocalProvider()) return 0;
  const client = db();
  const claimed = await client.rpc("claim_notifications");
  if (claimed.error) throw Error("File indisponible");
  let processed = 0;
  for (const job of claimed.data || []) {
    const configured = integrationStatus();
    if (
      !configured["Envois externes autorisés"] ||
      !configured[job.transport === "whatsapp" ? "WhatsApp" : "Email"]
    ) {
      await client
        .from("notification_outbox")
        .update({
          status: "unconfigured",
          last_error: "Transport non configuré ou envois externes désactivés.",
        })
        .eq("id", job.id);
      continue;
    }
    try {
      let text = "";
      let to = process.env.ADMIN_EMAIL!;
      let parameters: string[] = [];
      if (job.booking_id) {
        const result = await client
          .from("bookings")
          .select(
            "id,service_name,status,clients(first_name,email),time_allocations(start_at)",
          )
          .eq("id", job.booking_id)
          .single();
        if (result.error || result.data.status !== "confirmed")
          throw Error("Réservation non confirmée");
        const b = result.data;
        const c = b.clients as unknown as { first_name: string; email: string };
        const t = b.time_allocations as unknown as { start_at: string };
        parameters = [
          b.id.slice(0, 8).toUpperCase(),
          b.service_name,
          localDate(t.start_at),
          c.first_name,
        ];
        text = `${brand.name} · Rendez-vous confirmé : ${parameters.join(" · ")} (Europe/Paris).`;
        if (job.transport === "email") to = c.email;
      } else {
        const { data: c, error } = await client
          .from("contact_messages")
          .select("first_name,subject")
          .eq("id", job.contact_id)
          .single();
        if (error) throw Error("Message absent");
        text = `${brand.name} · Nouvelle demande de ${c.first_name} : ${c.subject}. Consultez votre espace privé.`;
      }
      let response: Response;
      if (job.transport === "whatsapp") {
        if (!/^v\d+\.\d+$/.test(process.env.META_GRAPH_API_VERSION || ""))
          throw Error("Version Graph API invalide");
        response = await fetch(
          `https://graph.facebook.com/${process.env.META_GRAPH_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: process.env.WHATSAPP_ADMIN_TO,
              type: "template",
              template: {
                name: process.env.WHATSAPP_TEMPLATE_NAME,
                language: { code: process.env.WHATSAPP_TEMPLATE_LANG },
                components: [
                  {
                    type: "body",
                    parameters: parameters.map((text) => ({
                      type: "text",
                      text,
                    })),
                  },
                ],
              },
            }),
            signal: AbortSignal.timeout(15000),
          },
        );
      } else {
        response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": job.idempotency_key,
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM,
            to: [to],
            subject: job.booking_id
              ? "MONÉA · Votre rendez-vous est confirmé"
              : "MONÉA · Nouvelle demande de contact",
            text,
            html: `<div style="background:#f8f3ed;padding:36px;color:#131c1b;font-family:Arial"><h1 style="font-family:Georgia">Une parenthèse pour vous.</h1><p>${escapeHtml(text)}</p><p>Message transactionnel · aucune communication commerciale.</p></div>`,
          }),
          signal: AbortSignal.timeout(15000),
        });
      }
      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          await client
            .from("notification_outbox")
            .update({
              status: job.attempts >= 5 ? "failed" : "pending",
              last_error: `Fournisseur HTTP ${response.status}`,
              next_attempt_at: new Date(
                Date.now() + Math.pow(2, job.attempts) * 60000,
              ).toISOString(),
            })
            .eq("id", job.id);
          continue;
        }
        throw Error(`Fournisseur HTTP ${response.status}`);
      }
      const result = await response.json();
      await client
        .from("notification_outbox")
        .update({
          status: "sent",
          provider_id: result.id || result.messages?.[0]?.id || null,
          last_error: null,
        })
        .eq("id", job.id);
      processed++;
    } catch (e) {
      const ambiguous =
        e instanceof Error &&
        (e.name === "TimeoutError" || e.name === "TypeError");
      await client
        .from("notification_outbox")
        .update({
          status: ambiguous ? "uncertain" : "failed",
          last_error: ambiguous
            ? "Résultat fournisseur incertain : vérifier avant reprise."
            : "Échec de traitement. Vérifier le fournisseur et la configuration.",
        })
        .eq("id", job.id);
    }
  }
  return processed;
}
