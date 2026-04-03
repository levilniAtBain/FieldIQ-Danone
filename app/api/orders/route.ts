import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { orders, pharmacies } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.query.orders.findMany({
    where: eq(orders.repId, session.userId),
    orderBy: [desc(orders.createdAt)],
    columns: {
      id: true,
      status: true,
      totalAmount: true,
      createdAt: true,
      sourceType: true,
      submittedAt: true,
      deliveredAt: true,
      pharmacyId: true,
    },
    with: {
      pharmacy: {
        columns: { id: true, name: true, city: true },
      },
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
