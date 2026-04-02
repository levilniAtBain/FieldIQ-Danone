import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { PharmacyDetailView } from "@/components/pharmacies/pharmacy-detail-view";
import {
  getPharmacyById,
  canAccessPharmacy,
} from "@/lib/db/queries/pharmacies";

export default async function PharmacyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return null;

  const [pharmacy, hasAccess] = await Promise.all([
    getPharmacyById(id),
    canAccessPharmacy(session.userId, session.role, id),
  ]);

  if (!pharmacy || !hasAccess) notFound();

  return <PharmacyDetailView pharmacy={pharmacy} session={session} />;
}
