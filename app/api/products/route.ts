import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq, and, ilike, or, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const brand = req.nextUrl.searchParams.get("brand")?.trim() ?? "";
  const category = req.nextUrl.searchParams.get("category")?.trim() ?? "";

  const conditions = [eq(products.isActive, true)];

  if (q) {
    conditions.push(
      or(
        ilike(products.name, `%${q}%`),
        ilike(products.sku, `%${q}%`),
        ilike(products.category, `%${q}%`),
        ilike(sql`${products.brand}::text`, `%${q}%`),
        ilike(products.description, `%${q}%`)
      )!
    );
  }
  if (brand) conditions.push(ilike(sql`${products.brand}::text`, brand));
  if (category) conditions.push(ilike(products.category, `%${category}%`));

  const results = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      brand: products.brand,
      category: products.category,
      description: products.description,
      imageUrl: products.imageUrl,
      productUrl: products.productUrl,
      videoUrl: products.videoUrl,
      unitPrice: products.unitPrice,
    })
    .from(products)
    .where(and(...conditions))
    .orderBy(products.brand, products.name)
    .limit(100);

  return NextResponse.json(results);
}
