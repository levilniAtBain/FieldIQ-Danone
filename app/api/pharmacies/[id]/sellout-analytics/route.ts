import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { visitSelloutLines, visitStockLines, visits, products, pharmacies } from "@/lib/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: pharmacyId } = await params;

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify access: rep must own the pharmacy, manager must own it via their reps
  const pharmacy = await db.query.pharmacies.findFirst({
    where: eq(pharmacies.id, pharmacyId),
    columns: { id: true, repId: true },
  });
  if (!pharmacy) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (session.role === "rep" && pharmacy.repId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── 1. Top sellers ────────────────────────────────────────────────────────
  const topSellersRaw = await db
    .select({
      productId: visitSelloutLines.productId,
      sku: products.sku,
      name: products.name,
      brand: products.brand,
      totalQtySold: sql<number>`SUM(${visitSelloutLines.qtySold})::int`,
      latestPeriod: sql<string | null>`MAX(${visitSelloutLines.periodLabel})`,
    })
    .from(visitSelloutLines)
    .innerJoin(products, eq(visitSelloutLines.productId, products.id))
    .where(eq(visitSelloutLines.pharmacyId, pharmacyId))
    .groupBy(visitSelloutLines.productId, products.sku, products.name, products.brand)
    .orderBy(sql`SUM(${visitSelloutLines.qtySold}) DESC`)
    .limit(10);

  // ── 2. Latest stock per product ───────────────────────────────────────────
  // Get the most recent stock line per product
  const latestStockRaw = await db
    .select({
      productId: visitStockLines.productId,
      sku: products.sku,
      name: products.name,
      brand: products.brand,
      qtyInStock: visitStockLines.qtyInStock,
      createdAt: visitStockLines.createdAt,
    })
    .from(visitStockLines)
    .innerJoin(products, eq(visitStockLines.productId, products.id))
    .where(eq(visitStockLines.pharmacyId, pharmacyId))
    .orderBy(desc(visitStockLines.createdAt));

  // Deduplicate: keep only most recent per product
  const latestStockMap = new Map<string, { sku: string; name: string; brand: string; qtyInStock: number }>();
  for (const row of latestStockRaw) {
    if (row.productId && !latestStockMap.has(row.productId)) {
      latestStockMap.set(row.productId, {
        sku: row.sku,
        name: row.name,
        brand: row.brand,
        qtyInStock: row.qtyInStock,
      });
    }
  }

  // ── 3. Sell-out totals per product (for rotation) ─────────────────────────
  const selloutTotalsRaw = await db
    .select({
      productId: visitSelloutLines.productId,
      totalQtySold: sql<number>`SUM(${visitSelloutLines.qtySold})::int`,
      distinctPeriods: sql<number>`COUNT(DISTINCT ${visitSelloutLines.periodLabel})::int`,
    })
    .from(visitSelloutLines)
    .where(and(
      eq(visitSelloutLines.pharmacyId, pharmacyId),
      sql`${visitSelloutLines.productId} IS NOT NULL`
    ))
    .groupBy(visitSelloutLines.productId);

  const selloutMap = new Map<string, { totalQtySold: number; distinctPeriods: number }>();
  for (const row of selloutTotalsRaw) {
    if (row.productId) {
      selloutMap.set(row.productId, {
        totalQtySold: row.totalQtySold,
        distinctPeriods: Math.max(row.distinctPeriods, 1),
      });
    }
  }

  // ── 4. Build stock risk table ─────────────────────────────────────────────
  type RiskLevel = "critical" | "warning" | "ok";
  const stockRisk: Array<{
    productId: string; sku: string; name: string; brand: string;
    latestStock: number; avgMonthlySales: number; rotationDays: number | null;
    risk: RiskLevel;
  }> = [];

  for (const [productId, stock] of latestStockMap.entries()) {
    const sellout = selloutMap.get(productId);
    const avgMonthlySales = sellout
      ? Math.round((sellout.totalQtySold / sellout.distinctPeriods) * 10) / 10
      : 0;
    const rotationDays = avgMonthlySales > 0
      ? Math.round((stock.qtyInStock / avgMonthlySales) * 30)
      : null;

    let risk: RiskLevel = "ok";
    if (stock.qtyInStock === 0 && avgMonthlySales > 0) risk = "critical";
    else if (rotationDays !== null && rotationDays < 15) risk = "critical";
    else if (rotationDays !== null && rotationDays < 30) risk = "warning";

    stockRisk.push({
      productId,
      sku: stock.sku,
      name: stock.name,
      brand: stock.brand,
      latestStock: stock.qtyInStock,
      avgMonthlySales,
      rotationDays,
      risk,
    });
  }

  // Sort: critical first, then warning, then ok; within group by rotation asc
  const riskOrder: Record<RiskLevel, number> = { critical: 0, warning: 1, ok: 2 };
  stockRisk.sort((a, b) => {
    const rd = riskOrder[a.risk] - riskOrder[b.risk];
    if (rd !== 0) return rd;
    return (a.rotationDays ?? 999) - (b.rotationDays ?? 999);
  });

  // ── 5. Sell-out by brand ──────────────────────────────────────────────────
  const byBrandRaw = await db
    .select({
      brand: products.brand,
      totalQtySold: sql<number>`SUM(${visitSelloutLines.qtySold})::int`,
    })
    .from(visitSelloutLines)
    .innerJoin(products, eq(visitSelloutLines.productId, products.id))
    .where(eq(visitSelloutLines.pharmacyId, pharmacyId))
    .groupBy(products.brand)
    .orderBy(sql`SUM(${visitSelloutLines.qtySold}) DESC`);

  // ── 6. Sell-out trend (per visit) ─────────────────────────────────────────
  const trendRaw = await db
    .select({
      visitId: visitSelloutLines.visitId,
      totalQtySold: sql<number>`SUM(${visitSelloutLines.qtySold})::int`,
      periodLabel: sql<string | null>`MAX(${visitSelloutLines.periodLabel})`,
      visitStartedAt: visits.startedAt,
      visitScheduledAt: visits.scheduledAt,
    })
    .from(visitSelloutLines)
    .innerJoin(visits, eq(visitSelloutLines.visitId, visits.id))
    .where(eq(visitSelloutLines.pharmacyId, pharmacyId))
    .groupBy(visitSelloutLines.visitId, visits.startedAt, visits.scheduledAt)
    .orderBy(visits.startedAt);

  const selloutTrend = trendRaw.map((r) => ({
    visitDate: (r.visitStartedAt ?? r.visitScheduledAt ?? new Date()).toISOString().slice(0, 10),
    totalQtySold: r.totalQtySold,
    periodLabel: r.periodLabel,
  }));

  // ── 7. Summary flags ──────────────────────────────────────────────────────
  const hasSelloutData = topSellersRaw.length > 0;
  const hasStockData = latestStockMap.size > 0;

  const lastImportDate = hasSelloutData
    ? (await db
        .select({ createdAt: visitSelloutLines.createdAt })
        .from(visitSelloutLines)
        .where(eq(visitSelloutLines.pharmacyId, pharmacyId))
        .orderBy(desc(visitSelloutLines.createdAt))
        .limit(1))[0]?.createdAt?.toISOString().slice(0, 10) ?? null
    : null;

  return NextResponse.json({
    hasSelloutData,
    hasStockData,
    lastImportDate,
    topSellers: topSellersRaw.map((r) => ({
      productId: r.productId,
      sku: r.sku,
      name: r.name,
      brand: r.brand,
      totalQtySold: r.totalQtySold,
      latestPeriod: r.latestPeriod,
    })),
    stockRisk,
    selloutByBrand: byBrandRaw,
    selloutTrend,
  });
}
