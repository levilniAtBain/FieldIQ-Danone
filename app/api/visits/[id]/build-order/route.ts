import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { visits, orders, orderLines, visitFiles, visitSelloutLines, visitStockLines, products, pharmacies } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getLastOrderForPharmacy,
  getAllProductsForOrder,
  getPeerProductSuggestions,
} from "@/lib/db/queries/orders";
import { buildOrderWithAI, type ShelfAnalysisResult } from "@/lib/ai/claude";

const schema = z.object({
  voiceTranscript: z.string().nullable().optional(),
  scannedItems: z
    .array(
      z.object({
        productName: z.string(),
        sku: z.string().nullable(),
        quantity: z.number(),
      })
    )
    .optional()
    .default([]),
  typedNotes: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: visitId } = await params;

  const session = await getSession();
  if (!session || session.role !== "rep") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const visit = await db.query.visits.findFirst({
    where: eq(visits.id, visitId),
    columns: { id: true, repId: true, pharmacyId: true, audioTranscript: true },
  });

  if (!visit || visit.repId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pharmacy = await db.query.pharmacies.findFirst({
    where: eq(pharmacies.id, visit.pharmacyId),
    columns: { name: true, accountType: true, notes: true, mainSpecialty: true, secondarySpecialty: true },
  });

  const [lastOrder, allProducts, peerSuggestions, shelfFiles, selloutRows, stockRows] = await Promise.all([
    getLastOrderForPharmacy(visit.pharmacyId),
    getAllProductsForOrder(),
    getPeerProductSuggestions(visit.pharmacyId, session.userId),
    db.select({ aiAnalysisJson: visitFiles.aiAnalysisJson })
      .from(visitFiles)
      .where(and(eq(visitFiles.visitId, visitId), eq(visitFiles.type, "shelf_photo"))),
    db.select({
        qtySold: visitSelloutLines.qtySold,
        periodLabel: visitSelloutLines.periodLabel,
        sku: products.sku,
        name: products.name,
      })
      .from(visitSelloutLines)
      .innerJoin(products, eq(visitSelloutLines.productId, products.id))
      .where(eq(visitSelloutLines.visitId, visitId)),
    db.select({
        qtyInStock: visitStockLines.qtyInStock,
        sku: products.sku,
        name: products.name,
      })
      .from(visitStockLines)
      .innerJoin(products, eq(visitStockLines.productId, products.id))
      .where(eq(visitStockLines.visitId, visitId)),
  ]);

  const shelfAnalyses = shelfFiles
    .map((f) => f.aiAnalysisJson as ShelfAnalysisResult | null)
    .filter((a): a is ShelfAnalysisResult => a !== null);

  const voiceTranscript =
    parsed.data.voiceTranscript ?? visit.audioTranscript ?? null;

  // Combine typed notes into transcript
  const fullTranscript = [voiceTranscript, parsed.data.typedNotes]
    .filter(Boolean)
    .join("\n");

  try {
    const aiResult = await buildOrderWithAI({
      pharmacyName: pharmacy?.name ?? "",
      accountType: pharmacy?.accountType ?? "pharmacy",
      doctorNotes: pharmacy?.notes ?? null,
      mainSpecialty: pharmacy?.mainSpecialty ?? null,
      secondarySpecialty: pharmacy?.secondarySpecialty ?? null,
      shelfAnalyses,
      lastOrderLines:
        lastOrder?.lines.map((l) => ({
          sku: l.product.sku,
          name: l.product.name,
          quantity: l.quantity,
          brand: l.product.brand,
        })) ?? [],
      scannedOrderItems: parsed.data.scannedItems,
      voiceTranscript: fullTranscript || null,
      peerSuggestions: peerSuggestions.map((p) => ({
        sku: p.sku,
        name: p.name,
        peerAvgQty: p.peerAvgQty,
        brand: p.brand,
      })),
      availableProducts: allProducts,
      sellOutData: selloutRows.map((r) => ({
        sku: r.sku,
        name: r.name,
        qtySold: r.qtySold,
        periodLabel: r.periodLabel,
      })),
      stockData: stockRows.map((r) => ({
        sku: r.sku,
        name: r.name,
        qtyInStock: r.qtyInStock,
      })),
    });

    // Map SKUs back to product IDs
    const skuMap = new Map(allProducts.map((p) => [p.sku, p]));

    type ResolvedLine = {
      productId: string;
      sku: string;
      name: string;
      brand: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      source: string;
      rationale: string;
    };

    const resolvedLines: ResolvedLine[] = aiResult.lines.flatMap((line) => {
      const product = skuMap.get(line.sku);
      if (!product) return [];
      const unitPrice = parseFloat(product.unitPrice ?? "0");
      return [{
        productId: product.id,
        sku: product.sku,
        name: product.name,
        brand: product.brand as string,
        quantity: line.quantity,
        unitPrice,
        lineTotal: line.quantity * unitPrice,
        source: line.source,
        rationale: line.rationale,
      }];
    });

    const totalAmount = resolvedLines.reduce((s, l) => s + l.lineTotal, 0);

    // Persist as draft order
    const [order] = await db
      .insert(orders)
      .values({
        pharmacyId: visit.pharmacyId,
        repId: session.userId,
        visitId,
        status: "draft",
        sourceType: "voice",
        totalAmount: totalAmount.toFixed(2),
      })
      .returning({ id: orders.id });

    if (resolvedLines.length > 0) {
      await db.insert(orderLines).values(
        resolvedLines.map((l) => ({
          orderId: order.id,
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice.toFixed(2),
          lineTotal: l.lineTotal.toFixed(2),
        }))
      );
    }

    return NextResponse.json({
      orderId: order.id,
      lines: resolvedLines,
      summary: aiResult.summary,
      warnings: aiResult.warnings,
      totalAmount,
    });
  } catch (err) {
    console.error("Order build error:", err);
    return NextResponse.json(
      { error: "AI order generation failed. Please try again." },
      { status: 500 }
    );
  }
}
