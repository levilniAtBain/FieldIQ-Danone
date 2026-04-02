import { db } from "@/lib/db";
import { orders, orderLines, products, pharmacies } from "@/lib/db/schema";
import { eq, desc, and, ne, inArray } from "drizzle-orm";

export async function getLastOrderForPharmacy(pharmacyId: string) {
  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.pharmacyId, pharmacyId),
      ne(orders.status, "cancelled")
    ),
    orderBy: [desc(orders.createdAt)],
    with: {
      lines: {
        with: {
          product: {
            columns: {
              id: true,
              sku: true,
              name: true,
              brand: true,
              category: true,
              unitPrice: true,
            },
          },
        },
      },
    },
  });
  return order ?? null;
}

export async function getAllProductsForOrder() {
  return db.query.products.findMany({
    where: eq(products.isActive, true),
    columns: {
      id: true,
      sku: true,
      name: true,
      brand: true,
      category: true,
      unitPrice: true,
    },
    orderBy: [products.brand, products.name],
  });
}

// Products frequently ordered by pharmacies in the same region as this one
export async function getPeerProductSuggestions(
  pharmacyId: string,
  repId: string,
  limit = 8
) {
  // Get sibling pharmacies managed by the same rep (excluding self)
  const siblingPharmacies = await db.query.pharmacies.findMany({
    where: and(eq(pharmacies.repId, repId), ne(pharmacies.id, pharmacyId)),
    columns: { id: true },
  });

  if (siblingPharmacies.length === 0) return [];

  const siblingIds = siblingPharmacies.map((p) => p.id);

  // Get recent orders from sibling pharmacies
  const siblingOrders = await db.query.orders.findMany({
    where: inArray(orders.pharmacyId, siblingIds),
    orderBy: [desc(orders.createdAt)],
    with: {
      lines: {
        with: {
          product: {
            columns: {
              id: true,
              sku: true,
              name: true,
              brand: true,
              category: true,
              unitPrice: true,
            },
          },
        },
      },
    },
  });

  // Aggregate product popularity across sibling orders
  const productCount = new Map<
    string,
    {
      product: (typeof siblingOrders)[0]["lines"][0]["product"];
      orderCount: number;
      totalQty: number;
    }
  >();

  for (const order of siblingOrders) {
    for (const line of order.lines) {
      const existing = productCount.get(line.productId);
      if (existing) {
        existing.orderCount++;
        existing.totalQty += line.quantity;
      } else {
        productCount.set(line.productId, {
          product: line.product,
          orderCount: 1,
          totalQty: line.quantity,
        });
      }
    }
  }

  return Array.from(productCount.values())
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, limit)
    .map((p) => ({
      ...p.product,
      peerOrderCount: p.orderCount,
      peerAvgQty: Math.round(p.totalQty / p.orderCount),
    }));
}

export async function getOrderById(orderId: string) {
  return db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: {
      lines: {
        with: {
          product: true,
        },
      },
    },
  });
}
