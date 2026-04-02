/**
 * Import products from a CSV file into the database.
 * Usage: npx tsx scripts/import-products.ts import/loreal_product_catalog_updated.csv
 *
 * Upserts on SKU — safe to run multiple times.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { products } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

const VALID_BRANDS = [
  "vichy", "cerave", "la_roche_posay", "skinceuticals",
  "skinbetter", "mixa", "nyx", "biotherm", "medik8", "other",
] as const;

type Brand = typeof VALID_BRANDS[number];

function parseCsv(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    // Handle quoted fields with commas inside
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === "," && !inQuotes) { values.push(current.trim()); current = ""; }
      else { current += char; }
    }
    values.push(current.trim());
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx scripts/import-products.ts <path-to-csv>");
    process.exit(1);
  }

  const rows = parseCsv(path.resolve(filePath));
  console.log(`📦 Found ${rows.length} products in CSV`);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const brand = row.brand?.trim().toLowerCase();
    if (!VALID_BRANDS.includes(brand as Brand)) {
      console.warn(`⚠️  Skipping ${row.sku}: unknown brand "${brand}"`);
      skipped++;
      continue;
    }
    if (!row.sku?.trim() || !row.name?.trim()) {
      console.warn(`⚠️  Skipping row: missing sku or name`);
      skipped++;
      continue;
    }

    const values = {
      sku: row.sku.trim(),
      name: row.name.trim(),
      brand: brand as Brand,
      category: row.category?.trim() || "other",
      description: row.description?.trim() || null,
      imageUrl: row.image_url?.trim() || null,
      productUrl: row.product_url?.trim() || null,
      unitPrice: row.unit_price?.trim() || null,
      isActive: true,
    };

    // Upsert on SKU
    const existing = await db.execute(
      sql`SELECT id FROM products WHERE sku = ${values.sku} LIMIT 1`
    );

    if (existing.rows.length > 0) {
      await db.execute(sql`
        UPDATE products SET
          name = ${values.name},
          brand = ${values.brand}::brand,
          category = ${values.category},
          description = ${values.description},
          image_url = ${values.imageUrl},
          product_url = ${values.productUrl},
          unit_price = ${values.unitPrice},
          is_active = true
        WHERE sku = ${values.sku}
      `);
      updated++;
    } else {
      await db.execute(sql`
        INSERT INTO products (sku, name, brand, category, description, image_url, product_url, unit_price, is_active)
        VALUES (
          ${values.sku}, ${values.name}, ${values.brand}::brand,
          ${values.category}, ${values.description}, ${values.imageUrl},
          ${values.productUrl}, ${values.unitPrice}, true
        )
      `);
      inserted++;
    }
  }

  console.log(`✅ Done — ${inserted} inserted, ${updated} updated, ${skipped} skipped`);
  await pool.end();
}

main().catch((e) => {
  console.error("❌ Import failed:", e);
  process.exit(1);
});
