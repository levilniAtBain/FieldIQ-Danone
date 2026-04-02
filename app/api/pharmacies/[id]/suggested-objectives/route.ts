import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getPharmacyById, canAccessPharmacy } from "@/lib/db/queries/pharmacies";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { suggestVisitObjectives, type BriefingContext } from "@/lib/ai/claude";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json([], { status: 200 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [pharmacy, hasAccess] = await Promise.all([
    getPharmacyById(id),
    canAccessPharmacy(session.userId, session.role, id),
  ]);

  if (!pharmacy || !hasAccess) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rep = await db.query.users.findFirst({
    where: eq(users.id, pharmacy.repId),
    columns: { name: true },
  });

  const lastVisit = pharmacy.visits?.[0] ?? null;

  const context: BriefingContext = {
    pharmacyName: pharmacy.name,
    pharmacistName: pharmacy.pharmacistName ?? null,
    city: pharmacy.city,
    tier: pharmacy.tier,
    segment: pharmacy.segment ?? null,
    notes: pharmacy.notes ?? null,
    repName: rep?.name ?? "Unknown rep",
    lastVisitDate: lastVisit?.completedAt
      ? new Date(lastVisit.completedAt).toLocaleDateString("en-GB")
      : null,
    lastVisitNotes: lastVisit?.notes ?? null,
    visitCount: pharmacy.visits?.length ?? 0,
    pendingActions: [],
  };

  try {
    const objectives = await suggestVisitObjectives(context);
    return NextResponse.json(objectives);
  } catch (err) {
    console.error("Suggested objectives error:", err);
    return NextResponse.json([]);
  }
}
