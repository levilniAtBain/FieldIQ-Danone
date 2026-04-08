import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { masterPlanEntries, masterPlanCoVisitors } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "rep") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = await db.query.masterPlanEntries.findMany({
    where: eq(masterPlanEntries.repId, session.userId),
    orderBy: [desc(masterPlanEntries.plannedDate)],
    with: {
      pharmacy: { columns: { id: true, name: true, city: true } },
      coVisitors: true,
    },
  });

  return NextResponse.json({ entries });
}

const VISIT_TYPES = ["follow_up", "specialist_mv", "specialist_merchandising", "presentation"] as const;

const createSchema = z.object({
  pharmacyId: z.string().uuid(),
  plannedDate: z.string().datetime(),
  visitType: z.enum(VISIT_TYPES).optional(),
  specialistName: z.string().optional(),
  specialistRole: z.enum(["mv", "merchandiser"]).optional(),
  objectives: z.string().optional(),
  keyAttentionPoints: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "rep") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const [entry] = await db
    .insert(masterPlanEntries)
    .values({
      repId: session.userId,
      pharmacyId: parsed.data.pharmacyId,
      plannedDate: new Date(parsed.data.plannedDate),
      visitType: parsed.data.visitType ?? "follow_up",
      objectives: parsed.data.objectives ?? null,
      keyAttentionPoints: parsed.data.keyAttentionPoints ?? null,
    })
    .returning({ id: masterPlanEntries.id });

  // Auto-add co-visitor if specialist was selected
  if (parsed.data.specialistName && parsed.data.specialistRole) {
    await db.insert(masterPlanCoVisitors).values({
      masterPlanId: entry.id,
      role: parsed.data.specialistRole,
      name: parsed.data.specialistName,
    });
  }

  return NextResponse.json({ id: entry.id });
}
