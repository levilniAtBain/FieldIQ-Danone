import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { perfectStoreVisits, pharmacies } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { computePillarScores, PICOS_PILLARS, type PillarId } from "@/lib/perfect-store/checklist";

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch all PS visits for this rep (or all if manager)
  const visitRows = await db
    .select({
      id: perfectStoreVisits.id,
      pharmacyId: perfectStoreVisits.pharmacyId,
      visitDate: perfectStoreVisits.visitDate,
      picosScore: perfectStoreVisits.picosScore,
      kpisJson: perfectStoreVisits.kpisJson,
      checklistJson: perfectStoreVisits.checklistJson,
    })
    .from(perfectStoreVisits)
    .where(
      session.role === "rep" ? eq(perfectStoreVisits.repId, session.userId) : undefined
    )
    .orderBy(desc(perfectStoreVisits.visitDate));

  // Fetch pharmacy metadata (including tier) for all pharmacies this rep has access to
  const repPharmacies = await db
    .select({ id: pharmacies.id, name: pharmacies.name, tier: pharmacies.tier })
    .from(pharmacies)
    .where(session.role === "rep" ? eq(pharmacies.repId, session.userId) : undefined);

  const pharmacyMap = Object.fromEntries(repPharmacies.map((p) => [p.id, p]));

  // ── Next Best Actions (derived from audit data) ────────────────────────────
  // Build set of pharmacies that have been audited
  const auditedPharmacyIds = new Set(visitRows.map((v) => v.pharmacyId));

  // Latest PICOS score per pharmacy (used below — computed again after visitRows check,
  // but we need a preliminary pass here for the early-return case)
  const latestScoreMap: Record<string, number | null> = {};
  for (const v of visitRows) {
    if (!(v.pharmacyId in latestScoreMap)) latestScoreMap[v.pharmacyId] = v.picosScore;
  }

  type NextBestAction = {
    id: string; pharmacyId: string; pharmacyName: string; pharmacyTier: string;
    type: string; title: string; dueAt: string | null; priority: "High" | "Med" | "Low";
  };

  const nextBestActions: NextBestAction[] = [];

  // 1. Never-audited pharmacies → highest priority
  for (const p of repPharmacies) {
    if (!auditedPharmacyIds.has(p.id)) {
      nextBestActions.push({
        id: `no-audit-${p.id}`,
        pharmacyId: p.id,
        pharmacyName: p.name,
        pharmacyTier: p.tier ?? "c",
        type: "audit_missing",
        title: "No Perfect Store audit yet — schedule first audit",
        dueAt: null,
        priority: "High",
      });
    }
  }

  // 2. Pharmacies with PICOS score < 40 → urgent follow-up
  for (const [pharmacyId, score] of Object.entries(latestScoreMap)) {
    if (score !== null && score < 40) {
      const p = pharmacyMap[pharmacyId];
      nextBestActions.push({
        id: `low-score-${pharmacyId}`,
        pharmacyId,
        pharmacyName: p?.name ?? "Unknown",
        pharmacyTier: p?.tier ?? "c",
        type: "low_picos",
        title: `PICOS score ${score}/100 — urgent improvement needed`,
        dueAt: null,
        priority: "High",
      });
    }
  }

  // 3. Pharmacies with PICOS score 40–59 → monitor
  for (const [pharmacyId, score] of Object.entries(latestScoreMap)) {
    if (score !== null && score >= 40 && score < 60) {
      const p = pharmacyMap[pharmacyId];
      nextBestActions.push({
        id: `mid-score-${pharmacyId}`,
        pharmacyId,
        pharmacyName: p?.name ?? "Unknown",
        pharmacyTier: p?.tier ?? "c",
        type: "monitor_picos",
        title: `PICOS score ${score}/100 — follow up to improve compliance`,
        dueAt: null,
        priority: "Med",
      });
    }
  }

  // Sort: High first, then Med; cap at 6
  nextBestActions.sort((a, b) => (a.priority === "High" ? -1 : 1) - (b.priority === "High" ? -1 : 1));
  nextBestActions.splice(6);

  if (visitRows.length === 0) {
    return NextResponse.json({
      visits: [],
      pharmacyScores: [],
      avgPicosScore: null,
      avgKpis: null,
      avgPillarScores: null,
      segmentCompliance: [],
      nextBestActions,
    });
  }

  // ── Per-pharmacy latest PICOS score ────────────────────────────────────────
  const pharmacyLatest: Record<
    string,
    { pharmacyId: string; pharmacyName: string; tier: string; latestPicosScore: number | null; latestKpis: unknown; visitCount: number }
  > = {};

  for (const v of visitRows) {
    const existing = pharmacyLatest[v.pharmacyId];
    const tier = pharmacyMap[v.pharmacyId]?.tier ?? "c";
    const name = pharmacyMap[v.pharmacyId]?.name ?? "Unknown";
    if (!existing) {
      pharmacyLatest[v.pharmacyId] = {
        pharmacyId: v.pharmacyId,
        pharmacyName: name,
        tier,
        latestPicosScore: v.picosScore,
        latestKpis: v.kpisJson,
        visitCount: 1,
      };
    } else {
      existing.visitCount++;
    }
  }

  const pharmacyScores = Object.values(pharmacyLatest);

  // ── Avg PICOS ──────────────────────────────────────────────────────────────
  const scored = visitRows.filter((v) => v.picosScore !== null);
  const avgPicosScore =
    scored.length > 0
      ? Math.round(scored.reduce((s, v) => s + (v.picosScore ?? 0), 0) / scored.length)
      : null;

  // ── Avg shelf KPIs ─────────────────────────────────────────────────────────
  const kpiFields = [
    "shareOfShelf", "extraDisplay", "coreOnShelfAvailability",
    "numberOfFacings", "qualityOfPositioning", "shareOfAssortment",
  ] as const;

  const kpiSums: Record<string, { sum: number; count: number }> = {};
  for (const f of kpiFields) kpiSums[f] = { sum: 0, count: 0 };

  for (const v of visitRows) {
    const kpis = v.kpisJson as Record<string, Record<string, number | null> | null> | null;
    if (!kpis) continue;
    for (const sectionKpis of Object.values(kpis)) {
      if (!sectionKpis) continue;
      for (const f of kpiFields) {
        const val = sectionKpis[f];
        if (typeof val === "number") { kpiSums[f].sum += val; kpiSums[f].count++; }
      }
    }
  }

  const avgKpis = Object.fromEntries(
    kpiFields.map((f) => [f, kpiSums[f].count > 0 ? Math.round(kpiSums[f].sum / kpiSums[f].count) : null])
  );

  // ── Avg pillar scores ──────────────────────────────────────────────────────
  const pillarSums: Record<PillarId, { sum: number; count: number }> = {
    availability: { sum: 0, count: 0 },
    visibility: { sum: 0, count: 0 },
    brand_experience: { sum: 0, count: 0 },
    advocacy: { sum: 0, count: 0 },
  };

  for (const v of visitRows) {
    const checklist = v.checklistJson as Record<string, string[]> | null;
    if (!checklist || Object.keys(checklist).length === 0) continue;
    const ps = computePillarScores(checklist);
    for (const pillar of PICOS_PILLARS) {
      pillarSums[pillar.id].sum += ps[pillar.id];
      pillarSums[pillar.id].count++;
    }
  }

  const avgPillarScores = Object.fromEntries(
    PICOS_PILLARS.map((p) => [
      p.id,
      pillarSums[p.id].count > 0 ? Math.round(pillarSums[p.id].sum / pillarSums[p.id].count) : null,
    ])
  ) as Record<PillarId, number | null>;

  // ── Compliance by store segment ────────────────────────────────────────────
  // Group pharmacyScores by tier, compute avg PICOS compliance
  const segmentConfig = [
    { tier: "a", label: "Strategic Partners",    color: "text-teal-600" },
    { tier: "b", label: "Core Pharmacies",        color: "text-blue-600" },
    { tier: "c", label: "Development pharmacies", color: "text-orange-500" },
  ];

  const segmentSums: Record<string, { sum: number; count: number }> = {};
  for (const sc of segmentConfig) segmentSums[sc.tier] = { sum: 0, count: 0 };

  for (const p of pharmacyScores) {
    if (p.latestPicosScore !== null && segmentSums[p.tier]) {
      segmentSums[p.tier].sum += p.latestPicosScore;
      segmentSums[p.tier].count++;
    }
  }

  const segmentCompliance = segmentConfig.map((sc) => {
    const avg = segmentSums[sc.tier].count > 0
      ? Math.round(segmentSums[sc.tier].sum / segmentSums[sc.tier].count)
      : null;
    const status =
      avg === null ? "No data"
      : avg >= 60  ? "On track"
      : avg >= 40  ? "Monitor"
      : "At risk";
    return { tier: sc.tier, label: sc.label, color: sc.color, compliance: avg, status };
  });

  return NextResponse.json({
    visits: visitRows.slice(0, 50),
    pharmacyScores,
    avgPicosScore,
    avgKpis,
    avgPillarScores,
    segmentCompliance,
    nextBestActions,
  });
}
