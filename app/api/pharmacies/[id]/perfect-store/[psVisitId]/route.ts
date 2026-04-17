import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { canAccessPharmacy } from "@/lib/db/queries/pharmacies";
import { db } from "@/lib/db";
import { perfectStoreVisits } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { computePicosScore, generateAuditSummary, ALL_SUB_ITEM_IDS } from "@/lib/perfect-store/checklist";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; psVisitId: string }> }
) {
  const { id, psVisitId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hasAccess = await canAccessPharmacy(session.userId, session.role, id);
  if (!hasAccess) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db
    .delete(perfectStoreVisits)
    .where(
      and(
        eq(perfectStoreVisits.id, psVisitId),
        eq(perfectStoreVisits.pharmacyId, id)
      )
    );

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; psVisitId: string }> }
) {
  const { id, psVisitId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hasAccess = await canAccessPharmacy(session.userId, session.role, id);
  if (!hasAccess) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const psVisit = await db.query.perfectStoreVisits.findFirst({
    where: and(
      eq(perfectStoreVisits.id, psVisitId),
      eq(perfectStoreVisits.pharmacyId, id)
    ),
    columns: { id: true },
  });
  if (!psVisit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { checklistJson, notes } = body as {
    checklistJson?: Record<string, string[]>;
    notes?: string;
  };

  const updateData: Partial<typeof perfectStoreVisits.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (checklistJson !== undefined) {
    // Validate sub-item IDs
    const sanitized: Record<string, string[]> = {};
    for (const [itemId, subIds] of Object.entries(checklistJson)) {
      sanitized[itemId] = subIds.filter((s) => ALL_SUB_ITEM_IDS.has(s));
    }
    const score = computePicosScore(sanitized);
    updateData.checklistJson = sanitized;
    updateData.picosScore = score;
    updateData.aiSummary = generateAuditSummary(sanitized, score);
  }

  if (notes !== undefined) {
    updateData.notes = notes;
  }

  const [updated] = await db
    .update(perfectStoreVisits)
    .set(updateData)
    .where(eq(perfectStoreVisits.id, psVisitId))
    .returning({
      id: perfectStoreVisits.id,
      picosScore: perfectStoreVisits.picosScore,
      checklistJson: perfectStoreVisits.checklistJson,
      aiSummary: perfectStoreVisits.aiSummary,
      notes: perfectStoreVisits.notes,
    });

  return NextResponse.json(updated);
}
