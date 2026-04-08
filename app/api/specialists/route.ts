import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { specialists, masterPlanEntries, masterPlanCoVisitors } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role") as "mv" | "merchandiser" | null;
  const pharmacyId = searchParams.get("pharmacyId");

  // Fetch all specialists (optionally filtered by role)
  const rows = await db.query.specialists.findMany({
    ...(role ? { where: eq(specialists.role, role) } : {}),
    orderBy: specialists.name,
  });

  // Determine which specialists have previously visited this pharmacy
  // by matching names against masterPlanCoVisitors for this pharmacy's plans
  let previousVisitorNames = new Set<string>();
  if (pharmacyId) {
    const plans = await db.query.masterPlanEntries.findMany({
      where: eq(masterPlanEntries.pharmacyId, pharmacyId),
      columns: { id: true },
    });
    if (plans.length > 0) {
      const coVisitors = await db.query.masterPlanCoVisitors.findMany({
        where: inArray(masterPlanCoVisitors.masterPlanId, plans.map((p) => p.id)),
        columns: { name: true },
      });
      previousVisitorNames = new Set(coVisitors.map((cv) => cv.name.toLowerCase().trim()));
    }
  }

  const enriched = rows.map((s) => ({
    ...s,
    hasVisited: previousVisitorNames.has(s.name.toLowerCase().trim()),
  }));

  // Sort: hasVisited first, then alphabetical
  enriched.sort((a, b) => {
    if (a.hasVisited && !b.hasVisited) return -1;
    if (!a.hasVisited && b.hasVisited) return 1;
    return a.name.localeCompare(b.name);
  });

  return NextResponse.json({ specialists: enriched });
}
