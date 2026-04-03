import { getSession } from "@/lib/auth/session";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { db } from "@/lib/db";
import { visits, orders, orderLines, products, pharmacies, users } from "@/lib/db/schema";
import { eq, and, gte, desc, sum, count, inArray } from "drizzle-orm";
import { subMonths, format } from "date-fns";

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) return null;

  const sixMonthsAgo = subMonths(new Date(), 6);

  // For managers: scope to reps in their region
  let repIds: string[] | null = null;
  if (session.role === "manager") {
    const manager = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: { regionId: true },
    });
    if (manager?.regionId) {
      const regionReps = await db.query.users.findMany({
        where: and(eq(users.regionId, manager.regionId), eq(users.role, "rep")),
        columns: { id: true },
      });
      repIds = regionReps.map((r) => r.id);
    } else {
      repIds = [];
    }
  }

  const ordersWhere =
    session.role === "rep"
      ? eq(orders.repId, session.userId)
      : repIds && repIds.length > 0
      ? and(inArray(orders.repId, repIds), gte(orders.submittedAt, sixMonthsAgo))
      : gte(orders.submittedAt, sixMonthsAgo); // fallback (no reps in region)

  const visitsWhere =
    session.role === "rep"
      ? and(eq(visits.repId, session.userId), gte(visits.completedAt, sixMonthsAgo))
      : repIds && repIds.length > 0
      ? and(inArray(visits.repId, repIds), gte(visits.completedAt, sixMonthsAgo))
      : gte(visits.completedAt, sixMonthsAgo);

  const pharmaciesWhere =
    session.role === "rep"
      ? eq(pharmacies.repId, session.userId)
      : repIds && repIds.length > 0
      ? inArray(pharmacies.repId, repIds)
      : undefined;

  const [topProducts, visitHistory, pharmacyCountRes] = await Promise.all([
    db
      .select({
        productId: orderLines.productId,
        productName: products.name,
        brand: products.brand,
        totalQty: sum(orderLines.quantity),
      })
      .from(orderLines)
      .innerJoin(orders, eq(orderLines.orderId, orders.id))
      .innerJoin(products, eq(orderLines.productId, products.id))
      .where(ordersWhere)
      .groupBy(orderLines.productId, products.name, products.brand)
      .orderBy(desc(sum(orderLines.quantity)))
      .limit(10),

    db
      .select({ completedAt: visits.completedAt })
      .from(visits)
      .where(visitsWhere),

    db
      .select({ count: count() })
      .from(pharmacies)
      .where(pharmaciesWhere),
  ]);

  // Group by month
  const visitsByMonth: Record<string, number> = {};
  for (let i = 5; i >= 0; i--) {
    const key = format(subMonths(new Date(), i), "MMM yy");
    visitsByMonth[key] = 0;
  }
  for (const v of visitHistory) {
    if (v.completedAt) {
      const key = format(new Date(v.completedAt), "MMM yy");
      if (key in visitsByMonth) visitsByMonth[key]++;
    }
  }

  const visitChartData = Object.entries(visitsByMonth).map(([month, c]) => ({
    month,
    visits: c,
  }));

  return (
    <AnalyticsView
      session={session}
      topProducts={topProducts.map((p) => ({
        name: p.productName,
        brand: p.brand,
        qty: Number(p.totalQty ?? 0),
      }))}
      visitChartData={visitChartData}
      pharmacyCount={pharmacyCountRes[0]?.count ?? 0}
    />
  );
}
