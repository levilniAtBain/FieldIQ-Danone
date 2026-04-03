import { db } from "@/lib/db";
import { visits, pharmacies, actions, orders, users } from "@/lib/db/schema";
import { eq, and, gte, lte, count, desc, isNull, inArray } from "drizzle-orm";
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
  return db.query.pharmacies.findMany({
    where: and(eq(pharmacies.repId, repId), eq(pharmacies.isActive, true)),
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
      .where(and(eq(visits.repId, repId), gte(visits.completedAt, weekAgo))),
    db
      .select({ count: count() })
      .from(orders)
      .where(and(eq(orders.repId, repId), gte(orders.submittedAt, monthAgo))),
    db
      .select({ count: count() })
      .from(actions)
      .where(
        and(eq(actions.repId, repId), isNull(actions.completedAt), isNull(actions.accepted))
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

// ─── Manager queries ──────────────────────────────────────────────────────────

async function getRegionRepIds(managerId: string): Promise<string[]> {
  const manager = await db.query.users.findFirst({
    where: eq(users.id, managerId),
    columns: { regionId: true },
  });
  if (!manager?.regionId) return [];
  const reps = await db.query.users.findMany({
    where: and(eq(users.regionId, manager.regionId), eq(users.role, "rep")),
    columns: { id: true },
  });
  return reps.map((r) => r.id);
}

export async function getManagerKPIs(managerId: string) {
  const repIds = await getRegionRepIds(managerId);
  if (repIds.length === 0) {
    return { repCount: 0, visitsThisWeek: 0, openActions: 0, pharmacyCount: 0 };
  }

  const weekAgo = subDays(new Date(), 7);

  const [visitsThisWeek, openActionsRes, pharmacyCount] = await Promise.all([
    db
      .select({ count: count() })
      .from(visits)
      .where(and(inArray(visits.repId, repIds), gte(visits.completedAt, weekAgo))),
    db
      .select({ count: count() })
      .from(actions)
      .where(and(inArray(actions.repId, repIds), isNull(actions.accepted))),
    db
      .select({ count: count() })
      .from(pharmacies)
      .where(and(inArray(pharmacies.repId, repIds), eq(pharmacies.isActive, true))),
  ]);

  return {
    repCount: repIds.length,
    visitsThisWeek: visitsThisWeek[0]?.count ?? 0,
    openActions: openActionsRes[0]?.count ?? 0,
    pharmacyCount: pharmacyCount[0]?.count ?? 0,
  };
}

export async function getManagerTeamStats(managerId: string) {
  const manager = await db.query.users.findFirst({
    where: eq(users.id, managerId),
    columns: { regionId: true },
  });
  if (!manager?.regionId) return [];

  const reps = await db.query.users.findMany({
    where: and(eq(users.regionId, manager.regionId), eq(users.role, "rep")),
    columns: { id: true, name: true, email: true },
  });

  if (reps.length === 0) return [];

  const weekAgo = subDays(new Date(), 7);

  return Promise.all(
    reps.map(async (rep) => {
      const [pharmacyCount, visitsThisWeek, openActionsRes, lastVisitRows] =
        await Promise.all([
          db
            .select({ count: count() })
            .from(pharmacies)
            .where(eq(pharmacies.repId, rep.id)),
          db
            .select({ count: count() })
            .from(visits)
            .where(
              and(eq(visits.repId, rep.id), gte(visits.completedAt, weekAgo))
            ),
          db
            .select({ count: count() })
            .from(actions)
            .where(
              and(eq(actions.repId, rep.id), isNull(actions.accepted))
            ),
          db
            .select({ completedAt: visits.completedAt })
            .from(visits)
            .where(
              and(
                eq(visits.repId, rep.id),
                eq(visits.status, "completed")  // only completed visits
              )
            )
            .orderBy(desc(visits.completedAt))
            .limit(1),
        ]);

      return {
        ...rep,
        pharmacyCount: pharmacyCount[0]?.count ?? 0,
        visitsThisWeek: visitsThisWeek[0]?.count ?? 0,
        openActions: openActionsRes[0]?.count ?? 0,
        lastVisitAt: lastVisitRows[0]?.completedAt ?? null,
      };
    })
  );
}
