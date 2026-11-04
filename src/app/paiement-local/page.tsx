import { notFound } from "next/navigation";
import { z } from "zod";
import { localRepository } from "@/lib/data/local";
import { mockPaymentsEnabled } from "@/lib/data/provider";
import { PageIntro } from "@/components/site";
import { MockPayment } from "@/components/mock-payment";
import { euro } from "@/lib/catalogue";
import { localDate } from "@/lib/booking/time";
export default async function MockPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  if (!mockPaymentsEnabled()) notFound();
  const p = await searchParams;
  if (!z.uuid().safeParse(p.token).success) notFound();
  const b = await localRepository().publicBooking(p.token!);
  if (!b) notFound();
  return (
    <section className="section narrow">
      <PageIntro eyebrow="SIMULATION LOCALE" title="Tester le paiement." />
      <p className="notice">
        Paiement entièrement fictif. Aucun débit, aucune carte bancaire et aucun
        envoi externe.
      </p>
      <div className="panel">
        <h2>{b.service_name}</h2>
        <p>
          {localDate(b.start_at)} · {euro(b.price_cents)} TTC fictifs
        </p>
        <p>
          État : {b.status} · {b.payment_status}
        </p>
        {b.status === "pending" ? (
          <MockPayment token={b.public_token} />
        ) : (
          <p>
            Cette session a déjà été traitée. Aucun paiement réel n’a eu lieu.
          </p>
        )}
      </div>
    </section>
  );
}
