import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { canAccessPharmacy } from "@/lib/db/queries/pharmacies";
import { db } from "@/lib/db";
import { visits } from "@/lib/db/schema";

const createVisitSchema = z.object({
  pharmacyId: z.string().uuid(),
  objectives: z.array(z.string()).optional().default([]),
  scheduledAt: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "rep") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createVisitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { pharmacyId, objectives, scheduledAt } = parsed.data;

  const hasAccess = await canAccessPharmacy(session.userId, session.role, pharmacyId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [visit] = await db
    .insert(visits)
    .values({
      pharmacyId,
      repId: session.userId,
      status: "in_progress",
      startedAt: new Date(),
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      objectivesJson: objectives,
    })
    .returning({ id: visits.id });

  return NextResponse.json({ visitId: visit.id });
}
