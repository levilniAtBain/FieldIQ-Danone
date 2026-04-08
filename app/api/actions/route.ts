import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { actions, pharmacies, actionTypeEnum } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

type ActionType = (typeof actionTypeEnum.enumValues)[number];

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "rep") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const acceptedParam = searchParams.get("accepted");

  // Get rep's pharmacies
  const repPharmacies = await db.query.pharmacies.findMany({
    where: eq(pharmacies.repId, session.userId),
    columns: { id: true, name: true, city: true },
  });
  const pharmacyIds = repPharmacies.map((p) => p.id);
  if (pharmacyIds.length === 0) return NextResponse.json({ actions: [] });

  const rows = await db.query.actions.findMany({
    where: and(
      inArray(actions.pharmacyId, pharmacyIds),
      ...(type ? [eq(actions.type, type as ActionType)] : []),
      ...(acceptedParam === "true" ? [eq(actions.accepted, true)] : []),
    ),
    with: { specialist: true },
    orderBy: actions.createdAt,
  });

  // Attach pharmacy info to each action
  const pharmacyMap = Object.fromEntries(repPharmacies.map((p) => [p.id, p]));
  const enriched = rows.map((a) => ({ ...a, pharmacy: pharmacyMap[a.pharmacyId] }));

  return NextResponse.json({ actions: enriched });
}
