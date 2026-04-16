import { GaugeCircle, Star, TrendingUp, Building2 } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { cn } from "@/lib/utils";
import type { PillarId } from "@/lib/perfect-store/checklist";

type KpiValues = {
  shareOfShelf: number | null;
  extraDisplay: number | null;
  coreOnShelfAvailability: number | null;
  numberOfFacings: number | null;
  qualityOfPositioning: number | null;
  shareOfAssortment: number | null;
};

type PharmacyScore = {
  pharmacyId: string;
  pharmacyName: string;
  tier: string;
  latestPicosScore: number | null;
  visitCount: number;
};

type SegmentCompliance = {
  tier: string;
  label: string;
  color: string;
  compliance: number | null;
  status: "On track" | "Monitor" | "At risk" | "No data";
};

type NextBestAction = {
  id: string;
  pharmacyId: string;
  pharmacyName: string;
  pharmacyTier: string;
  type: string;
  title: string;
  dueAt: string | null;
  priority: "High" | "Med" | "Low";
};

type RepKpisData = {
  visits: unknown[];
  pharmacyScores: PharmacyScore[];
  avgPicosScore: number | null;
  avgKpis: KpiValues | null;
  avgPillarScores: Record<PillarId, number | null> | null;
  segmentCompliance: SegmentCompliance[];
  nextBestActions: NextBestAction[];
};

// ── Pillar config ─────────────────────────────────────────────────────────────
const PILLARS: Array<{ id: PillarId; label: string; barColor: string }> = [
  { id: "availability",     label: "Availability",     barColor: "bg-green-500" },
  { id: "visibility",       label: "Visibility",       barColor: "bg-blue-500" },
  { id: "brand_experience", label: "Brand experience", barColor: "bg-violet-500" },
  { id: "advocacy",         label: "Advocacy",         barColor: "bg-orange-500" },
];

// ── KPI config ────────────────────────────────────────────────────────────────
const KPI_ROWS: Array<{
  field: keyof KpiValues;
  label: string;
  unit: string;
  barColor: string;
  toBarPct: (v: number) => number;
}> = [
  { field: "shareOfShelf",            label: "Share of Shelf",              unit: "%",   barColor: "bg-blue-500",   toBarPct: (v) => Math.min(v, 100) },
  { field: "extraDisplay",            label: "Extra Display",               unit: "",    barColor: "bg-blue-400",   toBarPct: (v) => Math.min(v * 20, 100) },
  { field: "coreOnShelfAvailability", label: "Core On Shelf Availability",  unit: "%",   barColor: "bg-teal-500",   toBarPct: (v) => Math.min(v, 100) },
  { field: "numberOfFacings",         label: "#Facings",                    unit: "",    barColor: "bg-blue-500",   toBarPct: (v) => Math.min(v * 5, 100) },
  { field: "qualityOfPositioning",    label: "Quality of Positioning",      unit: "/10", barColor: "bg-violet-500", toBarPct: (v) => Math.min(v * 10, 100) },
  { field: "shareOfAssortment",       label: "Share of Assortment",         unit: "%",   barColor: "bg-violet-400", toBarPct: (v) => Math.min(v, 100) },
];

// ── Misc ──────────────────────────────────────────────────────────────────────
const TIER_LABEL: Record<string, string> = { a: "Seg A", b: "Seg B", c: "Seg C", d: "Seg D" };
const TIER_COLOR: Record<string, string> = {
  a: "bg-teal-100 text-teal-800",
  b: "bg-blue-100 text-blue-800",
  c: "bg-orange-100 text-orange-800",
  d: "bg-gray-200 text-gray-700",
};

function scoreColor(score: number | null) {
  if (score === null) return "text-gray-400";
  if (score >= 80) return "text-green-700";
  if (score >= 60) return "text-amber-600";
  return "text-red-600";
}

async function fetchKpiData(baseUrl: string, cookie: string): Promise<RepKpisData | null> {
  try {
    const res = await fetch(`${baseUrl}/api/perfect-store/rep-kpis`, {
      headers: { Cookie: cookie },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function PerfectStoreKpisPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3020";
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
  const data = await fetchKpiData(baseUrl, cookieHeader);

  const hasData = data && (data.pharmacyScores.length > 0 || data.visits.length > 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
          <GaugeCircle size={18} className="text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Perfect Store KPIs</h1>
          <p className="text-sm text-gray-500">
            {session.role === "manager" ? "Team-level" : "Your"} Perfect Store performance
          </p>
        </div>
      </div>

      {!hasData ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center space-y-3">
          <GaugeCircle size={32} className="mx-auto text-gray-300" />
          <p className="text-sm font-medium text-gray-700">No audits recorded yet</p>
          <p className="text-xs text-gray-400 max-w-xs mx-auto">
            Open a pharmacy page, go to the "Perfect Store" tab, and run an audit. Scores will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Star className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Avg PICOS Score</p>
                <p className={cn("text-xl font-bold", scoreColor(data!.avgPicosScore))}>
                  {data!.avgPicosScore !== null ? data!.avgPicosScore : "—"}
                  <span className="text-sm font-normal text-gray-400"> / 100</span>
                </p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Pharmacies Audited</p>
                <p className="text-xl font-bold text-gray-900">{data!.pharmacyScores.length}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Audits</p>
                <p className="text-xl font-bold text-gray-900">{data!.visits.length}</p>
              </div>
            </div>
          </div>

          {/* Two-column KPI panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left — Compliance by PICOS Pillar */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
                Compliance by PICOS Pillar
              </p>
              <div className="space-y-4">
                {PILLARS.map((pillar) => {
                  const val = data!.avgPillarScores?.[pillar.id] ?? null;
                  return (
                    <div key={pillar.id} className="flex items-center gap-3">
                      <span className="text-sm text-gray-700 w-36 flex-shrink-0">{pillar.label}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", pillar.barColor)}
                          style={{ width: val !== null ? `${val}%` : "0%" }}
                        />
                      </div>
                      <span className="text-sm font-bold text-gray-800 w-10 text-right flex-shrink-0">
                        {val !== null ? `${val}%` : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right — Leading KPIs */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
                Leading KPIs — In-Store Execution Compliance
              </p>
              <div className="space-y-4">
                {KPI_ROWS.map((row) => {
                  const raw = data!.avgKpis?.[row.field] ?? null;
                  const barPct = raw !== null ? row.toBarPct(raw) : 0;
                  const displayVal = raw !== null ? `${raw}${row.unit}` : "—";
                  return (
                    <div key={row.field} className="flex items-center gap-3">
                      <span className="text-sm text-gray-700 w-44 flex-shrink-0">{row.label}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", row.barColor)}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-gray-800 w-12 text-right flex-shrink-0">
                        {displayVal}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Segment compliance + Next best actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Compliance by Store Segment */}
            {(data!.segmentCompliance?.length ?? 0) > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                    Compliance by Store Segment
                  </p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-50">
                      <th className="px-5 py-2.5 text-left text-xs text-gray-400 font-medium">Segment</th>
                      <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-medium">Compliance</th>
                      <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data!.segmentCompliance.map((seg) => (
                      <tr key={seg.tier}>
                        <td className={cn("px-5 py-3 text-sm font-semibold", seg.color)}>
                          {seg.label}
                        </td>
                        <td className="px-3 py-3">
                          <span className={cn(
                            "text-sm font-bold",
                            seg.compliance !== null
                              ? seg.compliance >= 60 ? "text-green-600"
                                : seg.compliance >= 40 ? "text-gray-700"
                                : "text-red-600"
                              : "text-gray-400"
                          )}>
                            {seg.compliance !== null ? `${seg.compliance}%` : "—"}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {seg.status === "On track" && (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">On track</span>
                          )}
                          {seg.status === "Monitor" && (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">Monitor</span>
                          )}
                          {seg.status === "At risk" && (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-800 text-white">At risk</span>
                          )}
                          {seg.status === "No data" && (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Next Best Actions — This Week */}
            {(data!.nextBestActions?.length ?? 0) > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                    Audit Follow-up Actions
                  </p>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Priority</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {data!.nextBestActions.map((action) => (
                    <div key={action.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{action.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {action.pharmacyName}
                          <span className="mx-1.5">·</span>
                          <span className={cn(
                            "font-medium",
                            action.pharmacyTier === "a" ? "text-teal-600"
                              : action.pharmacyTier === "b" ? "text-blue-600"
                              : action.pharmacyTier === "c" ? "text-orange-500"
                              : "text-gray-500"
                          )}>
                            Segment {action.pharmacyTier?.toUpperCase()}
                          </span>
                        </p>
                      </div>
                      <span className={cn(
                        "text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0",
                        action.priority === "High" ? "bg-red-100 text-red-700"
                          : action.priority === "Med" ? "bg-amber-100 text-amber-700"
                          : "bg-green-100 text-green-700"
                      )}>
                        {action.priority}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Per-pharmacy scores table */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h2 className="text-sm font-semibold text-gray-800">PICOS by pharmacy</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {data!.pharmacyScores
                .sort((a, b) => (b.latestPicosScore ?? -1) - (a.latestPicosScore ?? -1))
                .map((p) => (
                  <div key={p.pharmacyId} className="px-5 py-3 flex items-center gap-3">
                    <span className={cn(
                      "text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0",
                      TIER_COLOR[p.tier] ?? "bg-gray-100 text-gray-600"
                    )}>
                      {TIER_LABEL[p.tier] ?? p.tier}
                    </span>
                    <a
                      href={`/pharmacies/${p.pharmacyId}?tab=perfect-store`}
                      className="flex-1 text-sm font-medium text-gray-900 hover:text-amber-600 truncate"
                    >
                      {p.pharmacyName}
                    </a>
                    <span className="text-xs text-gray-400">{p.visitCount} audit{p.visitCount !== 1 ? "s" : ""}</span>
                    <span className={cn("text-sm font-bold w-12 text-right", scoreColor(p.latestPicosScore))}>
                      {p.latestPicosScore !== null ? p.latestPicosScore : "—"}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
