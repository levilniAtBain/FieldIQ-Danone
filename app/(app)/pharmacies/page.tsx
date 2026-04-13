import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { PharmaciesView } from "@/components/pharmacies/pharmacies-view";
import { getPharmaciesForUser } from "@/lib/db/queries/pharmacies";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { differenceInDays } from "date-fns";

function getVisitStatus(
  lastCompletedAt: Date | string | null | undefined
): "green" | "amber" | "red" {
  if (!lastCompletedAt) return "red";
  const days = differenceInDays(new Date(), new Date(lastCompletedAt));
  if (days <= 30) return "green";
  if (days <= 60) return "amber";
  return "red";
}

export default async function PharmaciesPage({
  searchParams,
}: {
  searchParams: Promise<{ rep?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { rep: filterRepId } = await searchParams;

  const raw = await getPharmaciesForUser(
    session.userId,
    session.role,
    filterRepId
  );

  // Compute visitStatus server-side to avoid hydration mismatches caused
  // by timezone differences between the server (UTC) and the client device.
  const pharmacies = raw.map((p) => ({
    ...p,
    visitStatus: getVisitStatus(p.visits?.[0]?.completedAt),
  }));

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
