"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Plus, Loader2, Star, Camera, ClipboardList,
  ChevronDown, ChevronUp, CheckSquare2, Square,
} from "lucide-react";
import { PerfectStoreUpdatePanel } from "./perfect-store-update-panel";
import { format } from "date-fns";
import { CHECKLIST_ITEMS, SECTION_LABELS, type ChecklistSection } from "@/lib/perfect-store/checklist";

type KpiValues = {
  shareOfShelf: number | null;
  extraDisplay: number | null;
  coreOnShelfAvailability: number | null;
  numberOfFacings: number | null;
  qualityOfPositioning: number | null;
  shareOfAssortment: number | null;
};

type PsFile = {
  id: string;
  shelfSection: string;
  storagePath: string;
  aiAnalysisJson: {
    overallScore?: number;
    summary?: string;
    stockouts?: string[];
    lowStock?: string[];
    competitorPresence?: string[];
    planogramIssues?: string[];
    recommendations?: string[];
  } | null;
};

type PsVisit = {
  id: string;
  visitDate: string;
  picosScore: number | null;
  notes: string | null;
  aiSummary: string | null;
  kpisJson: Record<string, KpiValues | null> | null;
  checklistJson: Record<string, string[]> | null;
  fileCount: number;
  files: PsFile[];
  repName: string;
};

type TabData = {
  visits: PsVisit[];
  latestKpis: Record<string, KpiValues | null> | null;
  latestSummary: string | null;
  avgPicosScore: number | null;
};

const KPI_LABELS: Record<keyof KpiValues, string> = {
  shareOfShelf: "Share of Shelf",
  extraDisplay: "Extra Displays",
  coreOnShelfAvailability: "Core Avail.",
  numberOfFacings: "Facings",
  qualityOfPositioning: "Positioning",
  shareOfAssortment: "Share of Assort.",
};

const KPI_UNIT: Record<keyof KpiValues, string> = {
  shareOfShelf: "%",
  extraDisplay: "",
  coreOnShelfAvailability: "%",
  numberOfFacings: "",
  qualityOfPositioning: "/10",
  shareOfAssortment: "%",
};

const SHELF_SECTION_LABEL: Record<string, string> = {
  main: "Main Shelf",
  brand: "Brand Shelf",
  solar: "Solar Shelf",
  deodorant: "Deodorant Shelf",
};

function scoreColor(score: number | null) {
  if (score === null) return "bg-gray-100 text-gray-500";
  if (score >= 80) return "bg-green-100 text-green-800";
  if (score >= 60) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

function AggregatedKpiCard({ kpisJson }: { kpisJson: Record<string, KpiValues | null> }) {
  const fields = Object.keys(KPI_LABELS) as (keyof KpiValues)[];
  const agg: Record<string, { sum: number; count: number }> = {};
  for (const f of fields) agg[f] = { sum: 0, count: 0 };

  for (const sectionKpis of Object.values(kpisJson)) {
    if (!sectionKpis) continue;
    for (const f of fields) {
      const v = sectionKpis[f];
      if (typeof v === "number") {
        agg[f].sum += v;
        agg[f].count++;
      }
    }
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {fields.map((f) => {
        const val = agg[f].count > 0 ? Math.round(agg[f].sum / agg[f].count) : null;
        return (
          <div key={f} className="bg-white/70 rounded-lg p-2 text-center">
            <p className="text-gray-500 leading-tight mb-1" style={{ fontSize: "10px" }}>{KPI_LABELS[f]}</p>
            <p className="text-sm font-bold text-gray-900">
              {val !== null ? `${val}${KPI_UNIT[f]}` : "—"}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// Read-only checklist view
function ChecklistReadOnly({ checklistJson }: { checklistJson: Record<string, string[]> }) {
  const sections = [...new Set(CHECKLIST_ITEMS.map((i) => i.section))] as ChecklistSection[];
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {SECTION_LABELS[section]}
          </p>
          <div className="space-y-2">
            {CHECKLIST_ITEMS.filter((i) => i.section === section).map((item) => {
              const checked = checklistJson[item.id] ?? [];
              const total = item.subItems.length;
              const ratio = total > 0 ? checked.length / total : 0;
              return (
                <div key={item.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-xs font-medium text-gray-800">
                      <span className="text-gray-400 mr-1">#{item.num}</span>
                      {item.label}
                    </p>
                    <span className={cn(
                      "text-xs font-semibold px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0",
                      ratio >= 1 ? "bg-green-100 text-green-700"
                        : ratio > 0 ? "bg-amber-100 text-amber-700"
                        : "bg-gray-100 text-gray-500"
                    )}>
                      {checked.length}/{total}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {item.subItems.map((sub) => {
                      const isChecked = checked.includes(sub.id);
                      return (
                        <div key={sub.id} className="flex items-center gap-2">
                          {isChecked ? (
                            <CheckSquare2 className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                          )}
                          <span className={cn(
                            "text-xs",
                            isChecked ? "text-gray-800 font-medium" : "text-gray-400"
                          )}>
                            {sub.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Photo report card (read-only)
function PhotoReportCard({ file }: { file: PsFile }) {
  const [expanded, setExpanded] = useState(false);
  const a = file.aiAnalysisJson;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 bg-white hover:bg-gray-50 text-left"
      >
        <Camera className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-800">
            {SHELF_SECTION_LABEL[file.shelfSection] ?? file.shelfSection}
          </p>
          {a && (
            <p className="text-xs text-gray-500">Score {a.overallScore ?? "?"}/10</p>
          )}
        </div>
        {a ? (
          expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        ) : (
          <span className="text-xs text-gray-400">No analysis</span>
        )}
      </button>

      {expanded && a && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-100 bg-gray-50 space-y-2">
          {a.summary && <p className="text-xs text-gray-700 leading-relaxed">{a.summary}</p>}
          {(a.stockouts?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-700 mb-0.5">Stockouts</p>
              <ul className="text-xs text-red-600 space-y-0.5">{a.stockouts!.map((s, i) => <li key={i}>• {s}</li>)}</ul>
            </div>
          )}
          {(a.lowStock?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-0.5">Low stock</p>
              <ul className="text-xs text-amber-600 space-y-0.5">{a.lowStock!.map((s, i) => <li key={i}>• {s}</li>)}</ul>
            </div>
          )}
          {(a.planogramIssues?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-0.5">Planogram issues</p>
              <ul className="text-xs text-gray-600 space-y-0.5">{a.planogramIssues!.map((s, i) => <li key={i}>• {s}</li>)}</ul>
            </div>
          )}
          {(a.competitorPresence?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-0.5">Competitors</p>
              <p className="text-xs text-gray-600">{a.competitorPresence!.join(", ")}</p>
            </div>
          )}
          {(a.recommendations?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold text-blue-700 mb-0.5">Recommendations</p>
              <ul className="text-xs text-blue-600 space-y-0.5">{a.recommendations!.map((s, i) => <li key={i}>• {s}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VisitRow({
  visit,
  onExpand,
  expanded,
}: {
  visit: PsVisit;
  onExpand: () => void;
  expanded: boolean;
}) {
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      {/* Row header — always visible */}
      <button
        onClick={onExpand}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900">
              {format(new Date(visit.visitDate), "dd MMM yyyy")}
            </span>
            {visit.picosScore !== null && (
              <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", scoreColor(visit.picosScore))}>
                PICOS {visit.picosScore}
              </span>
            )}
            {visit.fileCount > 0 && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Camera className="w-3 h-3" />
                {visit.fileCount}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{visit.repName}</p>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {/* AI Summary */}
          {visit.aiSummary && (
            <div className="px-4 py-3 bg-amber-50">
              <p className="text-xs font-semibold text-amber-700 mb-1">Audit Summary</p>
              <p className="text-xs text-gray-700 leading-relaxed">{visit.aiSummary}</p>
            </div>
          )}

          {/* Rep notes */}
          {visit.notes && (
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-gray-500 mb-1">Rep Notes</p>
              <p className="text-xs text-gray-700">{visit.notes}</p>
            </div>
          )}

          {/* KPI summary */}
          {visit.kpisJson && Object.keys(visit.kpisJson).length > 0 && (
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-gray-500 mb-2">KPIs</p>
              <AggregatedKpiCard kpisJson={visit.kpisJson} />
            </div>
          )}

          {/* Shelf photos + reports */}
          {visit.files.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-gray-500 mb-2">Shelf Photos</p>
              <div className="space-y-2">
                {visit.files.map((f) => (
                  <PhotoReportCard key={f.id} file={f} />
                ))}
              </div>
            </div>
          )}

          {/* Read-only checklist */}
          {visit.checklistJson && Object.keys(visit.checklistJson).length > 0 && (
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-gray-500 mb-2">PICOS Checklist</p>
              <ChecklistReadOnly checklistJson={visit.checklistJson} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type Props = {
  pharmacyId: string;
  session: { userId: string; role: string; name: string };
};

export function PharmacyPerfectStoreTab({ pharmacyId, session }: Props) {
  const [data, setData] = useState<TabData | null>(null);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeVisitId, setActiveVisitId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pharmacies/${pharmacyId}/perfect-store`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [pharmacyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleNewAudit = async () => {
    setCreating(true);
    try {
      const res = await fetch(`/api/pharmacies/${pharmacyId}/perfect-store`, { method: "POST" });
      if (res.ok) {
        const { id } = await res.json();
        setActiveVisitId(id);
        setPanelOpen(true);
      }
    } finally {
      setCreating(false);
    }
  };

  const handlePanelSaved = () => {
    setPanelOpen(false);
    setActiveVisitId(null);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  const visits = data?.visits ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Perfect Store Audits</h3>
          {data?.avgPicosScore !== null && data?.avgPicosScore !== undefined && (
            <p className="text-xs text-gray-500 mt-0.5">
              Average PICOS:{" "}
              <span className={cn(
                "font-semibold",
                data.avgPicosScore >= 80 ? "text-green-700"
                  : data.avgPicosScore >= 60 ? "text-amber-600"
                  : "text-red-600"
              )}>
                {data.avgPicosScore} / 100
              </span>
            </p>
          )}
        </div>
        <button
          onClick={handleNewAudit}
          disabled={creating}
          className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-60"
        >
          {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          New audit
        </button>
      </div>

      {/* Latest audit summary + KPIs */}
      {(data?.latestSummary || data?.latestKpis) && (
        <div className="bg-amber-50 rounded-xl border border-amber-100 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            <p className="text-sm font-semibold text-gray-800">Latest Audit</p>
          </div>
          {data.latestSummary && (
            <p className="text-xs text-gray-700 leading-relaxed">{data.latestSummary}</p>
          )}
          {data.latestKpis && Object.keys(data.latestKpis).length > 0 && (
            <AggregatedKpiCard kpisJson={data.latestKpis} />
          )}
        </div>
      )}

      {/* Visits list */}
      {visits.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
          <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">No audits yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Click "New audit" to record a Perfect Store assessment.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Audit history ({visits.length})
          </p>
          {visits.map((visit) => (
            <VisitRow
              key={visit.id}
              visit={visit}
              expanded={expandedId === visit.id}
              onExpand={() => setExpandedId((prev) => (prev === visit.id ? null : visit.id))}
            />
          ))}
        </div>
      )}

      {/* Slide-over panel */}
      {panelOpen && activeVisitId && (
        <PerfectStoreUpdatePanel
          pharmacyId={pharmacyId}
          psVisitId={activeVisitId}
          onClose={() => { setPanelOpen(false); setActiveVisitId(null); }}
          onSaved={handlePanelSaved}
        />
      )}
    </div>
  );
}
