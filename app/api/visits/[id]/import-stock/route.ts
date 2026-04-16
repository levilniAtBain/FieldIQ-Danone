import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { visits, products, visitStockLines } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { matchCsvLinesToProducts } from "@/lib/ai/claude";

function parseCsvText(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = splitCsvLine(lines[0], delimiter).map((h) =>
    h.replace(/^["']|["']$/g, "").trim().toLowerCase()
  );
  return lines.slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const values = splitCsvLine(line, delimiter).map((v) =>
        v.replace(/^["']|["']$/g, "").trim()
      );
      return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
    });
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === delimiter && !inQuotes) { values.push(current); current = ""; }
    else { current += char; }
  }
  values.push(current);
  return values;
}

function detectQtyCol(headers: string[]): string | null {
  const candidates = ["stock", "quantite", "qte", "qty", "quantity", "en stock",
    "quantité", "inventaire", "niveau stock", "stock actuel", "stock_actuel",
    "qty_stock", "qty in stock", "quantity in stock", "nb", "nombre"];
  return headers.find((h) => candidates.some((c) => h.includes(c))) ?? null;
}

function detectSkuCol(headers: string[]): string | null {
  const candidates = ["code", "sku", "référence", "reference", "ref", "code produit",
    "code article", "article", "ean", "cip", "code_produit", "codeproduit"];
  return headers.find((h) => candidates.some((c) => h.includes(c))) ?? null;
}

function detectNameCol(headers: string[]): string | null {
  const candidates = ["designation", "désignation", "libelle", "libellé", "nom",
    "name", "produit", "product", "article", "label", "description"];
  return headers.find((h) => candidates.some((c) => h.includes(c))) ?? null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: visitId } = await params;

  const session = await getSession();
  if (!session || session.role !== "rep") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const visit = await db.query.visits.findFirst({
    where: eq(visits.id, visitId),
    columns: { id: true, repId: true, pharmacyId: true },
  });
  if (!visit || visit.repId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const text = await (file as File).text();
  const rows = parseCsvText(text);
  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV is empty or unreadable" }, { status: 400 });
  }

  const headers = Object.keys(rows[0]);
  const qtyCol = detectQtyCol(headers);
  const skuCol = detectSkuCol(headers);
  const nameCol = detectNameCol(headers);

  if (!qtyCol || !nameCol) {
    return NextResponse.json(
      { error: `Colonnes manquantes. Détectées: ${headers.join(", ")}. Attendu: une colonne de désignation et une de stock.` },
      { status: 400 }
    );
  }

  const rawLines = rows
    .map((row) => ({
      rawName: row[nameCol] ?? "",
      rawSku: skuCol ? (row[skuCol] || null) : null,
      qty: parseInt(row[qtyCol] ?? "0", 10) || 0,
    }))
    .filter((l) => l.rawName && l.qty >= 0);

  if (rawLines.length === 0) {
    return NextResponse.json({ error: "No valid stock lines found in CSV" }, { status: 400 });
  }

  const catalog = await db
    .select({ id: products.id, sku: products.sku, name: products.name, brand: products.brand })
    .from(products)
    .where(eq(products.isActive, true));

  const matched = await matchCsvLinesToProducts(rawLines, catalog);

  await db.delete(visitStockLines).where(eq(visitStockLines.visitId, visitId));

  if (matched.length > 0) {
    await db.insert(visitStockLines).values(
      matched.map((m) => ({
        visitId,
        pharmacyId: visit.pharmacyId,
        productId: m.productId,
        rawProductName: m.rawName,
        rawSku: m.rawSku,
        qtyInStock: m.qty,
        matchConfidence: m.confidence,
      }))
    );
  }

  const matchedCount = matched.filter((m) => m.productId !== null).length;
  const unmatchedCount = matched.length - matchedCount;

  return NextResponse.json({
    matched: matchedCount,
    unmatched: unmatchedCount,
    total: matched.length,
  });
}
