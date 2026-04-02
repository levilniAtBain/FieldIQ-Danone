/**
 * PATCH /api/orders/[id]/lines — replace all lines on a draft order
 * (rep edits the AI-generated lines before submitting)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { orders, orderLines } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const schema = z.object({
  lines: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().min(1),
      unitPrice: z.number().min(0),
    })
  ),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;

  const session = await getSession();
  if (!session || session.role !== "rep") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    columns: { id: true, repId: true, status: true },
  });

  if (!order || order.repId !== session.userId || order.status !== "draft") {
    return NextResponse.json({ error: "Not found or not editable" }, { status: 404 });
  }

  const totalAmount = parsed.data.lines.reduce(
    (s, l) => s + l.quantity * l.unitPrice,
    0
  );

  // Replace lines atomically
  await db.delete(orderLines).where(eq(orderLines.orderId, orderId));

  if (parsed.data.lines.length > 0) {
    await db.insert(orderLines).values(
      parsed.data.lines.map((l) => ({
        orderId,
        productId: l.productId,
        quantity: l.quantity,
        unitPrice: l.unitPrice.toFixed(2),
        lineTotal: (l.quantity * l.unitPrice).toFixed(2),
      }))
    );
  }

  await db
    .update(orders)
    .set({ totalAmount: totalAmount.toFixed(2) })
    .where(eq(orders.id, orderId));

  return NextResponse.json({ ok: true, totalAmount });
}
