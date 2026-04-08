import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { actions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const patchSchema = z.object({
  accepted: z.boolean().optional(),
  assignedSpecialistId: z.string().uuid().nullable().optional(),
  scheduledVisitDate: z.string().datetime().nullable().optional(),
  specialistStatus: z.enum(["pending", "contacted", "confirmed"]).optional(),
  specialistNotes: z.string().nullable().optional(),
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
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const fields: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.accepted !== undefined) fields.accepted = d.accepted;
  if (d.assignedSpecialistId !== undefined) fields.assignedSpecialistId = d.assignedSpecialistId;
  if (d.scheduledVisitDate !== undefined) fields.scheduledVisitDate = d.scheduledVisitDate ? new Date(d.scheduledVisitDate) : null;
  if (d.specialistStatus !== undefined) fields.specialistStatus = d.specialistStatus;
  if (d.specialistNotes !== undefined) fields.specialistNotes = d.specialistNotes;

  const [updated] = await db
    .update(actions)
    .set(fields)
    .where(and(eq(actions.id, id), eq(actions.repId, session.userId)))
    .returning({ id: actions.id });

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
