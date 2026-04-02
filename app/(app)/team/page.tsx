import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users, pharmacies, visits } from "@/lib/db/schema";
import { eq, and, gte, count, desc } from "drizzle-orm";
import { subDays } from "date-fns";
import { TeamView } from "@/components/team/team-view";

export default async function TeamPage() {
  const session = await getSession();
  if (!session) return null;
  if (session.role !== "manager") redirect("/dashboard");

  // Get reps in same region
  const reps = await db.query.users.findMany({
    where: and(
      eq(users.regionId, session.regionId!),
      eq(users.role, "rep")
    ),
    columns: { id: true, name: true, email: true },
  });

  const weekAgo = subDays(new Date(), 7);

  // For each rep: pharmacy count, visits this week, last visit
  const repStats = await Promise.all(
    reps.map(async (rep) => {
      const [pharmacyCount, visitsThisWeek, lastVisitRows] = await Promise.all([
        db
          .select({ count: count() })
          .from(pharmacies)
          .where(eq(pharmacies.repId, rep.id)),
        db
          .select({ count: count() })
          .from(visits)
          .where(and(eq(visits.repId, rep.id), gte(visits.completedAt, weekAgo))),
        db
          .select({ completedAt: visits.completedAt })
          .from(visits)
          .where(eq(visits.repId, rep.id))
          .orderBy(desc(visits.completedAt))
          .limit(1),
      ]);

      return {
        ...rep,
        pharmacyCount: pharmacyCount[0]?.count ?? 0,
        visitsThisWeek: visitsThisWeek[0]?.count ?? 0,
        lastVisitAt: lastVisitRows[0]?.completedAt ?? null,
      };
    })
  );

  return <TeamView session={session} reps={repStats} />;
}
