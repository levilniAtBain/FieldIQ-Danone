/**
 * GET /api/orders/[id]/export — download order as CSV for L'Oréal import
 *
 * CSV format (standard L'Oréal order import):
 *   SKU,ProductName,Brand,Quantity,UnitPrice,LineTotal
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getOrderById } from "@/lib/db/queries/orders";
import { db } from "@/lib/db";
import { orders, pharmacies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;

  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const order = await getOrderById(orderId);
  if (!order) {
    return new Response("Not found", { status: 404 });
  }

  // Access check: rep owns it or manager in same region (simplified: rep owns it)
  if (session.role === "rep" && order.repId !== session.userId) {
    return new Response("Forbidden", { status: 403 });
  }

  const pharmacy = await db.query.pharmacies.findFirst({
    where: eq(pharmacies.id, order.pharmacyId),
    columns: { name: true, sfAccountId: true },
  });

  const date = new Date(order.createdAt).toISOString().split("T")[0];
  const filename = `order_${pharmacy?.name.replace(/\s+/g, "_")}_${date}.csv`;

  // Header comment row (metadata for the import system)
  const metaRows = [
    `# FieldIQ Order Export`,
    `# Pharmacy: ${pharmacy?.name ?? order.pharmacyId}`,
    `# SF Account ID: ${pharmacy?.sfAccountId ?? "N/A"}`,
    `# Order ID: ${order.id}`,
    `# Date: ${date}`,
    `# Status: ${order.status}`,
    `# Total: €${parseFloat(order.totalAmount ?? "0").toFixed(2)}`,
    ``,
  ];

  const header = "SKU,ProductName,Brand,Quantity,UnitPrice,LineTotal";
  const rows = order.lines.map((l) => {
    const sku = l.product.sku;
    const name = `"${l.product.name.replace(/"/g, '""')}"`;
    const brand = l.product.brand;
    const qty = l.quantity;
    const unit = parseFloat(l.unitPrice ?? "0").toFixed(2);
    const total = parseFloat(l.lineTotal ?? "0").toFixed(2);
    return `${sku},${name},${brand},${qty},${unit},${total}`;
  });

  const csv = [...metaRows, header, ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
