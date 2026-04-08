import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { masterPlanEntries, masterPlanCoVisitors } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

async function getOwned(id: string, repId: string) {
  return db.query.masterPlanEntries.findFirst({
    where: and(eq(masterPlanEntries.id, id), eq(masterPlanEntries.repId, repId)),
    with: {
      pharmacy: { columns: { id: true, name: true, city: true, tier: true } },
      coVisitors: { orderBy: [masterPlanCoVisitors.createdAt] },
    },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.role !== "rep") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entry = await getOwned(id, session.userId);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ entry });
}

const updateSchema = z.object({
  plannedDate: z.string().datetime().optional(),
  status: z.enum(["draft", "confirmed", "completed"]).optional(),
  visitType: z.enum(["follow_up", "specialist_mv", "specialist_merchandising", "presentation"]).optional(),
  objectives: z.string().nullable().optional(),
  keyAttentionPoints: z.string().nullable().optional(),
  repTakeaways: z.string().nullable().optional(),
  mvTakeaways: z.string().nullable().optional(),
  merchandiserTakeaways: z.string().nullable().optional(),
  // Co-visitor management
  addCoVisitor: z.object({ role: z.enum(["mv", "merchandiser"]), name: z.string().min(1), notes: z.string().optional() }).optional(),
  removeCoVisitorId: z.string().uuid().optional(),
  updateCoVisitor: z.object({ id: z.string().uuid(), confirmed: z.boolean().optional(), notes: z.string().optional() }).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.role !== "rep") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const entry = await db.query.masterPlanEntries.findFirst({
    where: and(eq(masterPlanEntries.id, id), eq(masterPlanEntries.repId, session.userId)),
    columns: { id: true },
  });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { addCoVisitor, removeCoVisitorId, updateCoVisitor, ...fields } = parsed.data;

  // Update main fields
  const updateFields: Record<string, unknown> = { updatedAt: new Date() };
  if (fields.plannedDate !== undefined) updateFields.plannedDate = new Date(fields.plannedDate);
  if (fields.status !== undefined) updateFields.status = fields.status;
  if (fields.visitType !== undefined) updateFields.visitType = fields.visitType;
  if (fields.objectives !== undefined) updateFields.objectives = fields.objectives;
  if (fields.keyAttentionPoints !== undefined) updateFields.keyAttentionPoints = fields.keyAttentionPoints;
  if (fields.repTakeaways !== undefined) updateFields.repTakeaways = fields.repTakeaways;
  if (fields.mvTakeaways !== undefined) updateFields.mvTakeaways = fields.mvTakeaways;
  if (fields.merchandiserTakeaways !== undefined) updateFields.merchandiserTakeaways = fields.merchandiserTakeaways;

  if (Object.keys(updateFields).length > 1) {
    await db.update(masterPlanEntries).set(updateFields).where(eq(masterPlanEntries.id, id));
  }

  // Co-visitor operations
  if (addCoVisitor) {
    await db.insert(masterPlanCoVisitors).values({
      masterPlanId: id,
      role: addCoVisitor.role,
      name: addCoVisitor.name,
      notes: addCoVisitor.notes ?? null,
    });
  }
  if (removeCoVisitorId) {
    await db.delete(masterPlanCoVisitors).where(
      and(eq(masterPlanCoVisitors.id, removeCoVisitorId), eq(masterPlanCoVisitors.masterPlanId, id))
    );
  }
  if (updateCoVisitor) {
    const cvFields: Record<string, unknown> = {};
    if (updateCoVisitor.confirmed !== undefined) cvFields.confirmed = updateCoVisitor.confirmed;
    if (updateCoVisitor.notes !== undefined) cvFields.notes = updateCoVisitor.notes;
    if (Object.keys(cvFields).length > 0) {
      await db.update(masterPlanCoVisitors).set(cvFields).where(
        and(eq(masterPlanCoVisitors.id, updateCoVisitor.id), eq(masterPlanCoVisitors.masterPlanId, id))
      );
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.role !== "rep") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deleted = await db
    .delete(masterPlanEntries)
    .where(and(eq(masterPlanEntries.id, id), eq(masterPlanEntries.repId, session.userId)))
    .returning({ id: masterPlanEntries.id });

  if (!deleted.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
