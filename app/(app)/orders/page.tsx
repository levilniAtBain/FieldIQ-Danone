import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { OrdersView } from "@/components/orders/orders-view";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export default async function OrdersPage() {
  const session = await getSession();
  if (!session) redirect("/login");

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

  return <OrdersView orders={rows} />;
}
