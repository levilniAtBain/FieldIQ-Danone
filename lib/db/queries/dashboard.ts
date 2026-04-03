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

export async function getRepOpenItems(repId: string) {
  const [openVisits, draftOrders, pendingActions] = await Promise.all([
    db.query.visits.findMany({
      where: and(eq(visits.repId, repId), eq(visits.status, "in_progress")),
      columns: { id: true, startedAt: true, createdAt: true },
      with: { pharmacy: { columns: { id: true, name: true } } },
      orderBy: [desc(visits.createdAt)],
    }),
    db.query.orders.findMany({
      where: and(eq(orders.repId, repId), eq(orders.status, "draft")),
      columns: { id: true, createdAt: true },
      with: { pharmacy: { columns: { id: true, name: true } } },
      orderBy: [desc(orders.createdAt)],
    }),
    db.query.actions.findMany({
      where: and(eq(actions.repId, repId), isNull(actions.accepted)),
      columns: { id: true, createdAt: true, title: true },
      with: { pharmacy: { columns: { id: true, name: true } } },
      orderBy: [desc(actions.createdAt)],
    }),
  ]);

  return { openVisits, draftOrders, pendingActions };
}
