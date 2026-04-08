import { getSession } from "@/lib/auth/session";
import { CatalogView } from "@/components/catalog/catalog-view";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

export default async function CatalogPage() {
  const session = await getSession();
  if (!session) return null;

  // Load initial full catalog server-side
  const allProducts = await db
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
    .where(eq(products.isActive, true))
    .orderBy(products.brand, products.name);

  // Distinct categories for filters
  const categoryRows = await db
    .selectDistinct({ category: products.category })
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(products.category);

  return (
    <CatalogView
      initialProducts={allProducts}
      categories={categoryRows.map((r) => r.category)}
    />
  );
}
