import csv, sys

out = []
out.append("ALTER TABLE products ADD COLUMN IF NOT EXISTS product_url text;\n")

with open("import/loreal_product_catalog_updated.csv", newline="", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        def val(v):
            if not v or not v.strip():
                return "NULL"
            return "'" + v.strip().replace("'", "''") + "'"

        brand = r["brand"].strip().lower()
        out.append(
            f"INSERT INTO products (sku, name, brand, category, description, image_url, product_url, unit_price, is_active) "
            f"VALUES ({val(r['sku'])}, {val(r['name'])}, {val(brand)}::brand, {val(r['category'])}, "
            f"{val(r['description'])}, {val(r['image_url'])}, {val(r['product_url'])}, {val(r['unit_price'])}, true) "
            f"ON CONFLICT (sku) DO UPDATE SET "
            f"name=EXCLUDED.name, brand=EXCLUDED.brand, category=EXCLUDED.category, "
            f"description=EXCLUDED.description, image_url=EXCLUDED.image_url, "
            f"product_url=EXCLUDED.product_url, unit_price=EXCLUDED.unit_price, is_active=true;\n"
        )

with open("import/import_products.sql", "w", encoding="utf-8") as f:
    f.writelines(out)

print(f"Generated {len(out)-1} product rows")
