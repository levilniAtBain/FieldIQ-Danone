import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { masterPlanEntries, masterPlanCoVisitors } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: pharmacyId } = await params;
  const session = await getSession();
  if (!session || session.role !== "rep") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = await db.query.masterPlanEntries.findMany({
    where: and(
      eq(masterPlanEntries.pharmacyId, pharmacyId),
      eq(masterPlanEntries.repId, session.userId)
    ),
    orderBy: [desc(masterPlanEntries.plannedDate)],
    with: {
      coVisitors: { orderBy: [masterPlanCoVisitors.createdAt] },
    },
  });

  return NextResponse.json({ entries });
}
