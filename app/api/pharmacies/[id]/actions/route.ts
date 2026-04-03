import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { canAccessPharmacy, getPharmacyById } from "@/lib/db/queries/pharmacies";
import { db } from "@/lib/db";
import { actions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { differenceInDays } from "date-fns";

function isSpecialistVisitNeeded(pharmacy: Awaited<ReturnType<typeof getPharmacyById>>) {
  if (!pharmacy) return false;
  const lastVisit = pharmacy.visits?.[0];
  if (!lastVisit?.completedAt) return true;
  const days = differenceInDays(new Date(), new Date(lastVisit.completedAt));
  if (days > 60) return true;
  const shelfAnalysis = lastVisit.shelfAnalysisJson as { overallScore?: number } | null;
  if (shelfAnalysis?.overallScore !== undefined && shelfAnalysis.overallScore < 6) return true;
  return false;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [pharmacy, hasAccess] = await Promise.all([
    getPharmacyById(id),
    canAccessPharmacy(session.userId, session.role, id),
  ]);
  if (!pharmacy || !hasAccess) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await db.query.actions.findMany({
    where: eq(actions.pharmacyId, id),
    orderBy: [desc(actions.createdAt)],
  });

  return NextResponse.json({
    actions: rows,
    specialistVisitRecommended: isSpecialistVisitNeeded(pharmacy),
  });
}
