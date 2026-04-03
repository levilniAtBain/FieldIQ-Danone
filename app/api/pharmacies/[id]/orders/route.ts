import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { canAccessPharmacy } from "@/lib/db/queries/pharmacies";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hasAccess = await canAccessPharmacy(session.userId, session.role, id);
  if (!hasAccess) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await db.query.orders.findMany({
    where: eq(orders.pharmacyId, id),
    orderBy: [desc(orders.createdAt)],
    columns: {
      id: true,
      status: true,
      totalAmount: true,
      createdAt: true,
      sourceType: true,
      submittedAt: true,
      deliveredAt: true,
    },
    with: {
      lines: {
        columns: {
          id: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
        },
        with: {
          product: {
            columns: { id: true, name: true, sku: true, brand: true },
          },
        },
      },
    },
  });

  return NextResponse.json({ orders: rows });
}
