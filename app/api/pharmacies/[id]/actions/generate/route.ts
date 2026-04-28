import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { canAccessPharmacy, getPharmacyById } from "@/lib/db/queries/pharmacies";
import { db } from "@/lib/db";
import { actions, pharmacies, orders, orderLines, products } from "@/lib/db/schema";
import { eq, and, inArray, ne } from "drizzle-orm";
import { differenceInDays, format, addDays } from "date-fns";
import {
  generateNextBestActions,
  type NextBestActionsContext,
} from "@/lib/ai/claude";

function getSeason(month: number): string {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const session = await getSession();
  if (!session || session.role !== "rep") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [pharmacy, hasAccess] = await Promise.all([
    getPharmacyById(id),
    canAccessPharmacy(session.userId, session.role, id),
  ]);
  if (!pharmacy || !hasAccess) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lastVisit = pharmacy.visits?.[0] ?? null;
  const shelfAnalysis = lastVisit?.shelfAnalysisJson as { overallScore?: number; summary?: string } | null;

  const daysSinceLastVisit = lastVisit?.completedAt
    ? differenceInDays(new Date(), new Date(lastVisit.completedAt))
    : null;

  const specialistVisitNeeded =
    !lastVisit?.completedAt ||
    (daysSinceLastVisit !== null && daysSinceLastVisit > 60) ||
    (shelfAnalysis?.overallScore !== undefined && shelfAnalysis.overallScore < 6);

  // Fetch previously accepted actions for context
  const acceptedActions = await db.query.actions.findMany({
    where: and(eq(actions.pharmacyId, id), eq(actions.accepted, true)),
    columns: { title: true },
  });

  // For hospitals: fetch peer accounts with same specialty and their ordered products
  let peerOrders: { accountName: string; products: string[] }[] = [];
  if (pharmacy.accountType === "hospital" && pharmacy.mainSpecialty) {
    const peers = await db.query.pharmacies.findMany({
      where: and(
        eq(pharmacies.mainSpecialty, pharmacy.mainSpecialty),
        eq(pharmacies.accountType, "hospital"),
        ne(pharmacies.id, id)
      ),
      columns: { id: true, name: true },
      limit: 5,
    });

    if (peers.length > 0) {
      const peerIds = peers.map((p) => p.id);
      const peerOrderRows = await db
        .select({ pharmacyId: orders.pharmacyId, productName: products.name })
        .from(orders)
        .innerJoin(orderLines, eq(orderLines.orderId, orders.id))
        .innerJoin(products, eq(products.id, orderLines.productId))
        .where(inArray(orders.pharmacyId, peerIds));

      const byPharmacy = new Map<string, Set<string>>();
      for (const row of peerOrderRows) {
        if (!byPharmacy.has(row.pharmacyId)) byPharmacy.set(row.pharmacyId, new Set());
        byPharmacy.get(row.pharmacyId)!.add(row.productName);
      }

      peerOrders = peers
        .filter((p) => byPharmacy.has(p.id))
        .map((p) => ({ accountName: p.name, products: Array.from(byPharmacy.get(p.id)!) }));
    }
  }

  const now = new Date();
  const context: NextBestActionsContext = {
    pharmacyName: pharmacy.name,
    city: pharmacy.city,
    tier: pharmacy.tier,
    segment: pharmacy.segment ?? null,
    currentDate: format(now, "d MMMM yyyy"),
    season: getSeason(now.getMonth() + 1),
    lastVisitDate: lastVisit?.completedAt
      ? format(new Date(lastVisit.completedAt), "d MMM yyyy")
      : null,
    daysSinceLastVisit,
    lastVisitNotes: lastVisit?.notes ?? null,
    shelfScore: shelfAnalysis?.overallScore ?? null,
    shelfSummary: shelfAnalysis?.summary ?? null,
    visitCount: pharmacy.visits?.length ?? 0,
    previouslyAcceptedActions: acceptedActions.map((a) => a.title),
    specialistVisitNeeded,
    accountType: pharmacy.accountType ?? "pharmacy",
    doctorNotes: pharmacy.notes ?? null,
    mainSpecialty: pharmacy.mainSpecialty ?? null,
    secondarySpecialty: pharmacy.secondarySpecialty ?? null,
    peerOrders,
  };

  let generated = await generateNextBestActions(context);

  // Enforce specialist visit if needed and Claude didn't include one
  if (specialistVisitNeeded && !generated.some((a) => a.type === "specialist_visit")) {
    const dueAt = format(addDays(now, 14), "yyyy-MM-dd");
    generated.push({
      type: "specialist_visit",
      title: "Schedule a Specialist Visit",
      description: daysSinceLastVisit && daysSinceLastVisit > 60
        ? `It has been ${daysSinceLastVisit} days since the last visit. A specialist visit is recommended to maintain the relationship and support the pharmacy team.`
        : shelfAnalysis?.overallScore !== undefined
        ? `Shelf score is ${shelfAnalysis.overallScore}/10. A specialist visit is recommended to improve product placement and provide pharmacist training.`
        : "No visits recorded yet. A specialist visit is recommended to establish the Danone presence at this pharmacy.",
      dueAt,
    });
  }

  // Insert all generated actions
  const inserted = await db
    .insert(actions)
    .values(
      generated.map((a) => ({
        pharmacyId: id,
        repId: session.userId,
        type: a.type,
        title: a.title,
        description: a.description,
        aiGenerated: true,
        dueAt: a.dueAt ? new Date(a.dueAt) : null,
      }))
    )
    .returning();

  return NextResponse.json({ actions: inserted });
}
