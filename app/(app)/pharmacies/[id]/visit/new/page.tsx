import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getPharmacyById, canAccessPharmacy } from "@/lib/db/queries/pharmacies";
import { VisitPage } from "@/components/visit/visit-page";

export default async function NewVisitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "rep") redirect(`/pharmacies/${id}`);

  const [pharmacy, hasAccess] = await Promise.all([
    getPharmacyById(id),
    canAccessPharmacy(session.userId, session.role, id),
  ]);

  if (!pharmacy || !hasAccess) notFound();

  return (
    <VisitPage
      pharmacy={{
        id: pharmacy.id,
        name: pharmacy.name,
        city: pharmacy.city,
        pharmacistName: pharmacy.pharmacistName ?? null,
        tier: pharmacy.tier,
        segment: pharmacy.segment ?? null,
      }}
      session={session}
    />
  );
}
