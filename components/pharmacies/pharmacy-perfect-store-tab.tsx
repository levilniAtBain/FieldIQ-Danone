"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Plus, Loader2, Star, Camera, ClipboardList,
  ChevronDown, ChevronUp, CheckSquare2, Square, AlertTriangle, Lightbulb, PencilLine, Trash2,
} from "lucide-react";
import { PerfectStoreUpdatePanel } from "./perfect-store-update-panel";
import { format } from "date-fns";
import { CHECKLIST_ITEMS, SECTION_LABELS, type ChecklistSection } from "@/lib/perfect-store/checklist";
import { PlanogramGuideButton } from "./planogram-guide-modal";

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

// Renders audit summary with bullet-point formatting
function AuditSummaryText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("What's working:")) {
          return <p key={i} className="text-xs font-semibold text-green-700 mt-2">{line}</p>;
        }
        if (line.startsWith("Needs improvement:")) {
          return <p key={i} className="text-xs font-semibold text-red-700 mt-2">{line}</p>;
        }
        if (line.startsWith("•")) {
          const isInNeeds = lines.slice(0, i).some((l) => l.startsWith("Needs improvement:"));
          return (
            <p key={i} className={cn(
              "text-xs pl-1 leading-snug",
              isInNeeds ? "text-red-700" : "text-green-700"
            )}>
              {line}
            </p>
          );
        }
        if (line.trim() === "") return null;
        return <p key={i} className="text-xs font-medium text-gray-800">{line}</p>;
      })}
    </div>
  );
}

type ImprovementAction = { type: "stockout" | "planogram" | "recommendation" | "checklist"; text: string };

function deriveImprovementActions(visit: PsVisit): ImprovementAction[] {
  const actions: ImprovementAction[] = [];
  const seen = new Set<string>();

  const add = (type: ImprovementAction["type"], text: string) => {
    const key = text.trim().toLowerCase();
    if (!seen.has(key)) { seen.add(key); actions.push({ type, text: text.trim() }); }
  };

  // From photo analyses
  for (const file of visit.files) {
    const a = file.aiAnalysisJson;
    if (!a) continue;
    for (const s of a.stockouts ?? []) add("stockout", `Restock ${s}`);
    for (const s of a.planogramIssues ?? []) add("planogram", s);
    for (const s of a.recommendations ?? []) add("recommendation", s);
  }

  // From checklist gaps (items with 0% compliance)
  if (visit.checklistJson) {
    for (const item of CHECKLIST_ITEMS) {
      const checked = visit.checklistJson[item.id] ?? [];
      if (item.subItems.length > 0 && checked.length === 0) {
        add("checklist", `Address: ${item.label}`);
      }
    }
  }

  return actions.slice(0, 8);
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
                    <div className="flex items-start gap-1 flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800">
                        <span className="text-gray-400 mr-1">#{item.num}</span>
                        {item.label}
                      </p>
                      {item.id === "item_2" && <PlanogramGuideButton />}
                    </div>
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
  onResume,
  onDelete,
}: {
  visit: PsVisit;
  onExpand: () => void;
  expanded: boolean;
  onResume?: () => void;
  onDelete?: () => void;
}) {
  const isDraft = visit.picosScore === null && !visit.aiSummary;

  return (
    <div className={cn(
      "border rounded-xl overflow-hidden",
      isDraft ? "border-amber-200 bg-amber-50/30" : "border-gray-100"
    )}>
      {/* Row header — always visible */}
      {isDraft ? (
        <div className="flex items-center gap-3 px-4 py-3 bg-white">
          {/* Left: date + badges (clickable → resume) */}
          <button onClick={onResume} className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-900">
                {format(new Date(visit.visitDate), "dd MMM yyyy")}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                Draft
              </span>
              {visit.fileCount > 0 && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Camera className="w-3 h-3" />
                  {visit.fileCount}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{visit.repName}</p>
          </button>
          {/* Right: Resume + Delete */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onResume}
              className="flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors"
            >
              <PencilLine className="w-3.5 h-3.5" />
              Resume
            </button>
            <button
              onClick={onDelete}
              className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Delete draft"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
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
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {/* AI Summary */}
          {visit.aiSummary && (
            <div className="px-4 py-3 bg-amber-50">
              <p className="text-xs font-semibold text-amber-700 mb-2">Audit Summary</p>
              <AuditSummaryText text={visit.aiSummary} />
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

  const handlePanelClose = async (keepDraft: boolean) => {
    if (!keepDraft && activeVisitId) {
      // Delete the empty visit silently
      await fetch(
        `/api/pharmacies/${pharmacyId}/perfect-store/${activeVisitId}`,
        { method: "DELETE" }
      );
    }
    setPanelOpen(false);
    setActiveVisitId(null);
    fetchData();
  };

  const handlePanelSaved = () => {
    setPanelOpen(false);
    setActiveVisitId(null);
    fetchData();
  };

  const handleResumeDraft = (visitId: string) => {
    setActiveVisitId(visitId);
    setPanelOpen(true);
  };

  const handleDeleteDraft = async (visitId: string) => {
    await fetch(`/api/pharmacies/${pharmacyId}/perfect-store/${visitId}`, { method: "DELETE" });
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

      {/* Latest audit summary + KPIs + actions */}
      {(data?.latestSummary || data?.latestKpis) && (() => {
        const latestVisit = visits[0] ?? null;
        const actions = latestVisit ? deriveImprovementActions(latestVisit) : [];
        return (
          <div className="bg-amber-50 rounded-xl border border-amber-100 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-semibold text-gray-800">Latest Audit</p>
            </div>

            {data.latestSummary && (
              <AuditSummaryText text={data.latestSummary} />
            )}

            {data.latestKpis && Object.keys(data.latestKpis).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">KPIs</p>
                <AggregatedKpiCard kpisJson={data.latestKpis} />
              </div>
            )}

            {actions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                  Improvement Actions
                </p>
                <div className="space-y-1.5">
                  {actions.map((action, i) => {
                    const icon =
                      action.type === "stockout" ? <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />
                      : action.type === "planogram" ? <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                      : <Lightbulb className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" />;
                    return (
                      <div key={i} className="flex items-start gap-2 bg-white/70 rounded-lg px-2.5 py-2">
                        {icon}
                        <p className="text-xs text-gray-700 leading-snug">{action.text}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

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
              onResume={() => handleResumeDraft(visit.id)}
              onDelete={() => handleDeleteDraft(visit.id)}
            />
          ))}
        </div>
      )}

      {/* Slide-over panel */}
      {panelOpen && activeVisitId && (
        <PerfectStoreUpdatePanel
          pharmacyId={pharmacyId}
          psVisitId={activeVisitId}
          onClose={handlePanelClose}
          onSaved={handlePanelSaved}
        />
      )}
    </div>
  );
}
