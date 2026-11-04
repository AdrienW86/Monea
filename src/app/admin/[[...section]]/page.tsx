import { redirect, notFound } from "next/navigation";
import { requireManagementAdmin } from "@/lib/auth/management";
import { repository } from "@/lib/data/repository";
import { isLocalProvider } from "@/lib/data/provider";
import { snapshotQuerySchema } from "@/lib/data/snapshot-query";
import { ManagementApp } from "@/components/management/app";

export default async function Admin({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<{ id?: string; page?: string; search?: string }>;
}) {
  const admin = await requireManagementAdmin().catch(() =>
    redirect("/admin/connexion"),
  );
  const [{ section }, query] = await Promise.all([params, searchParams]);
  const aliases: Record<string, string> = {
    agenda: "planning",
    blocages: "indisponibilites",
    prestations: "catalogue",
    audit: "parametres",
  };
  const requested = section?.join("/") || "";
  const page = aliases[requested] || requested;
  if (
    ![
      "",
      "planning",
      "rendez-vous",
      "clientes",
      "indisponibilites",
      "horaires",
      "catalogue",
      "categories",
      "notifications",
      "messages",
      "parametres",
    ].includes(page)
  )
    notFound();
  const options = snapshotQuerySchema.parse({
    section: page,
    page: query.page,
    search: query.search,
    bookingId: page === "rendez-vous" ? query.id : undefined,
  });
  return (
    <ManagementApp
      initialData={await repository().snapshot(
        isLocalProvider() ? undefined : options,
        admin.id,
      )}
      section={page}
      initialId={query.id}
    />
  );
}
