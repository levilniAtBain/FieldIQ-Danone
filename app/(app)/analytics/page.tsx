import { getSession } from "@/lib/auth/session";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { db } from "@/lib/db";
import { visits, orders, orderLines, products, pharmacies } from "@/lib/db/schema";
import { eq, and, gte, desc, sum, count } from "drizzle-orm";
import { subDays, subMonths, format } from "date-fns";

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) return null;

  const sixMonthsAgo = subMonths(new Date(), 6);

  // Top products by order quantity for this rep (or all reps for manager)
  const topProducts = await db
    .select({
      productId: orderLines.productId,
      productName: products.name,
      brand: products.brand,
      totalQty: sum(orderLines.quantity),
    })
    .from(orderLines)
    .innerJoin(orders, eq(orderLines.orderId, orders.id))
    .innerJoin(products, eq(orderLines.productId, products.id))
    .where(
      session.role === "rep"
        ? eq(orders.repId, session.userId)
        : gte(orders.submittedAt, sixMonthsAgo)
    )
    .groupBy(orderLines.productId, products.name, products.brand)
    .orderBy(desc(sum(orderLines.quantity)))
    .limit(10);

  // Visit frequency: visits per month over last 6 months
  const visitHistory = await db
    .select({ completedAt: visits.completedAt })
    .from(visits)
    .where(
      and(
        session.role === "rep"
          ? eq(visits.repId, session.userId)
          : gte(visits.completedAt, sixMonthsAgo),
        gte(visits.completedAt, sixMonthsAgo)
      )
    );

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

  const visitChartData = Object.entries(visitsByMonth).map(([month, count]) => ({
    month,
    visits: count,
  }));

  // Pharmacy count
  const [pharmacyCount] = await db
    .select({ count: count() })
    .from(pharmacies)
    .where(
      session.role === "rep" ? eq(pharmacies.repId, session.userId) : undefined
    );

  return (
    <AnalyticsView
      session={session}
      topProducts={topProducts.map((p) => ({
        name: p.productName,
        brand: p.brand,
        qty: Number(p.totalQty ?? 0),
      }))}
      visitChartData={visitChartData}
      pharmacyCount={pharmacyCount?.count ?? 0}
    />
  );
}
