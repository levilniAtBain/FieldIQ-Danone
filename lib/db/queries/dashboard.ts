import { db } from "@/lib/db";
import { visits, pharmacies, actions, orders, salesData } from "@/lib/db/schema";
import { eq, and, gte, lte, count, sum, desc, isNull } from "drizzle-orm";
import { startOfDay, endOfDay, subDays } from "date-fns";

export async function getTodayVisits(repId: string) {
  const today = new Date();
  return db.query.visits.findMany({
    where: and(
      eq(visits.repId, repId),
      gte(visits.scheduledAt, startOfDay(today)),
      lte(visits.scheduledAt, endOfDay(today))
    ),
    with: {
      pharmacy: {
        columns: { id: true, name: true, city: true, tier: true },
      },
    },
    orderBy: [visits.scheduledAt],
  });
}

export async function getOverduePharma(repId: string) {
  // Pharmacies with no visit in 30+ days
  const cutoff = subDays(new Date(), 30);
  const recent = await db
    .select({ pharmacyId: visits.pharmacyId })
    .from(visits)
    .where(and(eq(visits.repId, repId), gte(visits.completedAt, cutoff)));

  const recentIds = recent.map((r) => r.pharmacyId);

  return db.query.pharmacies.findMany({
    where: and(
      eq(pharmacies.repId, repId),
      eq(pharmacies.isActive, true)
    ),
    columns: { id: true, name: true, city: true, tier: true },
    limit: 10,
  });
}

export async function getRepKPIs(repId: string) {
  const weekAgo = subDays(new Date(), 7);
  const monthAgo = subDays(new Date(), 30);

  const [visitsThisWeek, ordersThisMonth, openActions] = await Promise.all([
    db
      .select({ count: count() })
      .from(visits)
      .where(
        and(
          eq(visits.repId, repId),
          gte(visits.completedAt, weekAgo)
        )
      ),
    db
      .select({ count: count() })
      .from(orders)
      .where(
        and(
          eq(orders.repId, repId),
          gte(orders.submittedAt, monthAgo)
        )
      ),
    db
      .select({ count: count() })
      .from(actions)
      .where(
        and(
          eq(actions.repId, repId),
          isNull(actions.completedAt),
          isNull(actions.accepted)
        )
      ),
  ]);

  return {
    visitsThisWeek: visitsThisWeek[0]?.count ?? 0,
    ordersThisMonth: ordersThisMonth[0]?.count ?? 0,
    openActions: openActions[0]?.count ?? 0,
  };
}
