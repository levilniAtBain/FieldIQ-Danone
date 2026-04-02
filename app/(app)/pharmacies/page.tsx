import { getSession } from "@/lib/auth/session";
import { PharmaciesView } from "@/components/pharmacies/pharmacies-view";
import { getPharmaciesForUser } from "@/lib/db/queries/pharmacies";

export default async function PharmaciesPage() {
  const session = await getSession();
  if (!session) return null;

  const pharmacies = await getPharmaciesForUser(session.userId, session.role);

  return <PharmaciesView pharmacies={pharmacies} />;
}
