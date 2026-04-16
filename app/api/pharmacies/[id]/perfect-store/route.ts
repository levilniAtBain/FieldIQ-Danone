import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { canAccessPharmacy } from "@/lib/db/queries/pharmacies";
import { db } from "@/lib/db";
import { perfectStoreVisits, perfectStoreFiles, users } from "@/lib/db/schema";
import { eq, desc, inArray } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hasAccess = await canAccessPharmacy(session.userId, session.role, id);
  if (!hasAccess) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch all visits for this pharmacy
  const visits = await db
    .select({
      id: perfectStoreVisits.id,
      visitDate: perfectStoreVisits.visitDate,
      picosScore: perfectStoreVisits.picosScore,
      notes: perfectStoreVisits.notes,
      aiSummary: perfectStoreVisits.aiSummary,
      kpisJson: perfectStoreVisits.kpisJson,
      checklistJson: perfectStoreVisits.checklistJson,
      repId: perfectStoreVisits.repId,
    })
    .from(perfectStoreVisits)
    .where(eq(perfectStoreVisits.pharmacyId, id))
    .orderBy(desc(perfectStoreVisits.visitDate));

  if (visits.length === 0) {
    return NextResponse.json({ visits: [], latestKpis: null, latestSummary: null, avgPicosScore: null });
  }

  const visitIds = visits.map((v) => v.id);

  // Fetch all files with their analysis for these visits
  const allFiles = await db
    .select({
      id: perfectStoreFiles.id,
      psVisitId: perfectStoreFiles.psVisitId,
      shelfSection: perfectStoreFiles.shelfSection,
      storagePath: perfectStoreFiles.storagePath,
      aiAnalysisJson: perfectStoreFiles.aiAnalysisJson,
    })
    .from(perfectStoreFiles)
    .where(inArray(perfectStoreFiles.psVisitId, visitIds));

  // Fetch rep names
  const repIds = [...new Set(visits.map((v) => v.repId))];
  const allReps = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(inArray(users.id, repIds));
  const repMap = Object.fromEntries(allReps.map((r) => [r.id, r.name]));

  // Group files by visitId
  const filesByVisit: Record<string, typeof allFiles> = {};
  for (const f of allFiles) {
    if (!filesByVisit[f.psVisitId]) filesByVisit[f.psVisitId] = [];
    filesByVisit[f.psVisitId].push(f);
  }

  const visitList = visits.map((v) => ({
    id: v.id,
    visitDate: v.visitDate,
    picosScore: v.picosScore,
    notes: v.notes,
    aiSummary: v.aiSummary,
    kpisJson: v.kpisJson,
    checklistJson: v.checklistJson,
    fileCount: (filesByVisit[v.id] ?? []).length,
    files: filesByVisit[v.id] ?? [],
    repName: repMap[v.repId] ?? "Unknown",
  }));

  // Latest: most recent visit with kpisJson or aiSummary
  const latestWithData = visitList.find((v) => v.kpisJson || v.aiSummary);

  const avgPicosScore =
    visits.filter((v) => v.picosScore !== null).length > 0
      ? Math.round(
          visits
            .filter((v) => v.picosScore !== null)
            .reduce((sum, v) => sum + (v.picosScore ?? 0), 0) /
            visits.filter((v) => v.picosScore !== null).length
        )
      : null;

  return NextResponse.json({
    visits: visitList,
    latestKpis: latestWithData?.kpisJson ?? null,
    latestSummary: latestWithData?.aiSummary ?? null,
    avgPicosScore,
  });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hasAccess = await canAccessPharmacy(session.userId, session.role, id);
  if (!hasAccess) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [newVisit] = await db
    .insert(perfectStoreVisits)
    .values({
      pharmacyId: id,
      repId: session.userId,
      visitDate: new Date(),
    })
    .returning({ id: perfectStoreVisits.id });

  return NextResponse.json({ id: newVisit.id }, { status: 201 });
}
