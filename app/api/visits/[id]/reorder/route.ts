import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { visits, orders, orderLines } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getLastOrderForPharmacy } from "@/lib/db/queries/orders";
import { format } from "date-fns";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: visitId } = await params;
  const session = await getSession();
  if (!session || session.role !== "rep") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const visit = await db.query.visits.findFirst({
    where: eq(visits.id, visitId),
    columns: { id: true, repId: true, pharmacyId: true },
  });

  if (!visit || visit.repId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Check no draft order already exists for this visit
  const existingOrder = await db.query.orders.findFirst({
    where: and(eq(orders.visitId, visitId), eq(orders.status, "draft")),
    columns: { id: true },
  });
  if (existingOrder) {
    return NextResponse.json(
      { error: "An order already exists for this visit. Use 'Rebuild order' to start over." },
      { status: 409 }
    );
  }

  const lastOrder = await getLastOrderForPharmacy(visit.pharmacyId);
  if (!lastOrder || lastOrder.lines.length === 0) {
    return NextResponse.json(
      { error: "No previous order found for this pharmacy." },
      { status: 404 }
    );
  }

  const warnings: string[] = [];

  const resolvedLines = lastOrder.lines.map((line) => {
    const currentPrice = parseFloat(line.product.unitPrice ?? "0");
    const historicalPrice = parseFloat(String(line.unitPrice));
    if (Math.abs(currentPrice - historicalPrice) > 0.01) {
      warnings.push(`${line.product.name}: price changed from €${historicalPrice.toFixed(2)} to €${currentPrice.toFixed(2)}`);
    }
    return {
      productId: line.product.id,
      sku: line.product.sku,
      name: line.product.name,
      brand: line.product.brand as string,
      quantity: line.quantity,
      unitPrice: currentPrice,
      lineTotal: line.quantity * currentPrice,
      source: "history" as const,
      rationale: `Reordered from ${lastOrder.createdAt ? format(new Date(lastOrder.createdAt), "dd MMM yyyy") : "last visit"}`,
    };
  });

  const totalAmount = resolvedLines.reduce((s, l) => s + l.lineTotal, 0);
  const orderDate = lastOrder.createdAt
    ? format(new Date(lastOrder.createdAt), "dd MMM yyyy")
    : "last visit";

  const [order] = await db
    .insert(orders)
    .values({
      pharmacyId: visit.pharmacyId,
      repId: session.userId,
      visitId,
      status: "draft",
      sourceType: "reorder",
      totalAmount: totalAmount.toFixed(2),
    })
    .returning({ id: orders.id });

  await db.insert(orderLines).values(
    resolvedLines.map((l) => ({
      orderId: order.id,
      productId: l.productId,
      quantity: l.quantity,
      unitPrice: l.unitPrice.toFixed(2),
      lineTotal: l.lineTotal.toFixed(2),
    }))
  );

  return NextResponse.json({
    orderId: order.id,
    lines: resolvedLines,
    summary: `Reorder from ${orderDate} — ${resolvedLines.length} product${resolvedLines.length !== 1 ? "s" : ""}`,
    warnings,
    totalAmount,
  });
}
