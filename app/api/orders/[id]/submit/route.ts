/**
 * POST /api/orders/[id]/submit — mark order as submitted
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;

  const session = await getSession();
  if (!session || session.role !== "rep") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    columns: { id: true, repId: true, status: true },
  });

  if (!order || order.repId !== session.userId || order.status !== "draft") {
    return NextResponse.json({ error: "Not found or already submitted" }, { status: 404 });
  }

  await db
    .update(orders)
    .set({ status: "submitted", submittedAt: new Date() })
    .where(eq(orders.id, orderId));

  return NextResponse.json({ ok: true });
}
