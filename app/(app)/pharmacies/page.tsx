import { getSession } from "@/lib/auth/session";
import { PharmaciesView } from "@/components/pharmacies/pharmacies-view";
import { getPharmaciesForUser } from "@/lib/db/queries/pharmacies";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function PharmaciesPage({
  searchParams,
}: {
  searchParams: Promise<{ rep?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const { rep: filterRepId } = await searchParams;

  const pharmacies = await getPharmaciesForUser(
    session.userId,
    session.role,
    filterRepId
  );

  // If filtering by rep, fetch the rep's name for the page heading
  let filterRepName: string | undefined;
  if (filterRepId) {
    const rep = await db.query.users.findFirst({
      where: eq(users.id, filterRepId),
      columns: { name: true },
    });
    filterRepName = rep?.name;
  }

  return (
    <PharmaciesView
      pharmacies={pharmacies}
      filterRepName={filterRepName}
    />
  );
}
