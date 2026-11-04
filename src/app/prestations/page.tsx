import { PageIntro } from "@/components/site";
import { Catalogue } from "@/components/catalogue";
import { getServices, getSettings } from "@/lib/db/queries";
import { pageMetadata } from "@/lib/brand-seo";
export async function generateMetadata() {
  const s = await getSettings();
  return pageMetadata(s, "Les prestations", "/prestations");
}
export default async function Services({
  searchParams,
}: {
  searchParams: Promise<{ categorie?: string }>;
}) {
  const [services, params] = await Promise.all([getServices(), searchParams]);
  return (
    <section className="section">
      <PageIntro eyebrow="LE CATALOGUE" title="À chaque envie, sa parenthèse.">
        <p>Découvrez nos univers de beauté, nos prestations et leurs tarifs.</p>
      </PageIntro>
      <Catalogue services={services} initial={params.categorie} />
    </section>
  );
}
