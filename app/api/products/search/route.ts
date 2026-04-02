import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq, and, ilike, or, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  const whereClause = q.length > 0
    ? and(
        eq(products.isActive, true),
        or(
          ilike(products.name, `%${q}%`),
          ilike(products.sku, `%${q}%`),
          ilike(products.category, `%${q}%`),
          ilike(sql`${products.brand}::text`, `%${q}%`)
        )
      )
    : eq(products.isActive, true);

  const results = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      brand: products.brand,
      category: products.category,
      unitPrice: products.unitPrice,
    })
    .from(products)
    .where(whereClause)
    .limit(20)
    .orderBy(products.brand, products.name);

  return NextResponse.json(results);
}
