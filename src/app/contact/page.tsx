import { PageIntro, WhatsAppButton } from "@/components/site";
import { ContactForm } from "@/components/contact-form";
import { getSettings } from "@/lib/db/queries";
import { dbConfigured } from "@/lib/db/server";
import { Photo } from "@/components/beauty-art";
import { editorial } from "@/config/editorial";
import { isLocalProvider } from "@/lib/data/provider";
import { pageMetadata } from "@/lib/brand-seo";
export async function generateMetadata() {
  return pageMetadata(
    await getSettings(),
    "Contact",
    "/contact",
    "Contactez MONÉA à Perpignan pour une question sur les prestations ou votre rendez-vous.",
  );
}
export default async function Contact() {
  const s = await getSettings();
  return (
    <section className="section">
      <PageIntro
        eyebrow="FAISONS CONNAISSANCE"
        title="Un petit mot, une envie ?"
      >
        <p>Une question sur une prestation ? Écrivez à MONÉA.</p>
      </PageIntro>
      <div className="admin-grid">
        <div>
          <ContactForm
            enabled={isLocalProvider() || (dbConfigured() && s.privacyReady)}
          />
        </div>
        <aside className="booking-aside">
          <Photo
            src={editorial.ambiance}
            alt="Ambiance d’intérieur imaginée, sans représentation du local réel"
            className="contact-aside-photo"
            sizes="(max-width: 700px) 90vw, 40vw"
          />
          <p className="eyebrow">MONÉA</p>
          <h2>
            {s.name}
            <br />
            <em>{s.city}</em>
          </h2>
          {s.address && <p>{s.address}</p>}
          {s.phone && (
            <p>
              <a href={`tel:${s.phone}`}>{s.phone}</a>
            </p>
          )}
          <WhatsAppButton number={s.whatsapp} />
        </aside>
      </div>
    </section>
  );
}
