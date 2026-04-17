"use client";

import { useRef, useState, useCallback } from "react";
import { X, Upload, Loader2, CheckCircle2, AlertCircle, Camera, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CHECKLIST_ITEMS,
  SECTION_LABELS,
  computePicosScore,
  type ChecklistSection,
} from "@/lib/perfect-store/checklist";
import { PlanogramGuideButton } from "./planogram-guide-modal";

type ShelfSection = "main" | "brand" | "solar" | "deodorant";

const SHELF_SECTIONS: { id: ShelfSection; label: string; description: string }[] = [
  { id: "main", label: "Main Shelf", description: "Integrated dermo-cosmetic shelf" },
  { id: "brand", label: "Brand Shelf", description: "L'Oréal brand-dedicated gondola" },
  { id: "solar", label: "Solar Shelf", description: "Sun care / solar products shelf" },
  { id: "deodorant", label: "Deodorant Shelf", description: "Deodorant section" },
];

type PhotoAnalysis = {
  overallScore: number;
  summary: string;
  stockouts: string[];
  lowStock: string[];
  competitorPresence: string[];
  planogramIssues: string[];
  recommendations: string[];
  checklistSuggestions: string[];
  kpis: Record<string, number | null>;
};

type PhotoState = {
  status: "idle" | "uploading" | "done" | "error";
  analysis?: PhotoAnalysis;
  error?: string;
};

type Props = {
  pharmacyId: string;
  psVisitId: string;
  onClose: (keepDraft: boolean) => void;
  onSaved: () => void;
};

export function PerfectStoreUpdatePanel({ pharmacyId, psVisitId, onClose, onSaved }: Props) {
  const [isDirty, setIsDirty] = useState(false);

  const [photoStates, setPhotoStates] = useState<Record<ShelfSection, PhotoState>>({
    main: { status: "idle" },
    brand: { status: "idle" },
    solar: { status: "idle" },
    deodorant: { status: "idle" },
  });
  const [expandedReport, setExpandedReport] = useState<ShelfSection | null>(null);

  // Collect all checklist suggestions from uploaded photos
  const allSuggestions = Object.values(photoStates)
    .filter((s) => s.status === "done")
    .flatMap((s) => s.analysis?.checklistSuggestions ?? []);

  // Checklist state: itemId → set of checked subItemIds
  const [checklist, setChecklist] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    for (const item of CHECKLIST_ITEMS) initial[item.id] = [];
    return initial;
  });

  // Pre-populate from AI suggestions (merge — don't replace manual selections)
  const [suggestionsApplied, setSuggestionsApplied] = useState(false);
  if (allSuggestions.length > 0 && !suggestionsApplied) {
    setSuggestionsApplied(true);
    const updated = { ...checklist };
    for (const item of CHECKLIST_ITEMS) {
      const suggested = item.subItems
        .filter((s) => allSuggestions.includes(s.id))
        .map((s) => s.id);
      updated[item.id] = [...new Set([...updated[item.id], ...suggested])];
    }
    setChecklist(updated);
  }

  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fileRefs: Record<ShelfSection, React.RefObject<HTMLInputElement | null>> = {
    main: useRef(null),
    brand: useRef(null),
    solar: useRef(null),
    deodorant: useRef(null),
  };

  const liveScore = computePicosScore(checklist);

  const handleFileSelect = useCallback(
    async (section: ShelfSection, file: File) => {
      setPhotoStates((prev) => ({ ...prev, [section]: { status: "uploading" } }));

      try {
        const buffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
        );
        const mimeType = file.type as "image/jpeg" | "image/png" | "image/webp";

        const res = await fetch(
          `/api/pharmacies/${pharmacyId}/perfect-store/${psVisitId}/upload-photo`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: base64, mimeType, shelfSection: section }),
          }
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Upload failed");
        }

        const data = await res.json();
        setIsDirty(true);
        setPhotoStates((prev) => ({
          ...prev,
          [section]: {
            status: "done",
            analysis: {
              overallScore: data.analysis?.overallScore ?? 0,
              summary: data.analysis?.summary ?? "",
              stockouts: data.analysis?.stockouts ?? [],
              lowStock: data.analysis?.lowStock ?? [],
              competitorPresence: data.analysis?.competitorPresence ?? [],
              planogramIssues: data.analysis?.planogramIssues ?? [],
              recommendations: data.analysis?.recommendations ?? [],
              checklistSuggestions: data.checklistSuggestions ?? [],
              kpis: data.kpis ?? {},
            },
          },
        }));
        // Auto-expand the report for the section just uploaded
        setExpandedReport(section);

        // Merge checklist suggestions
        if (data.checklistSuggestions?.length > 0) {
          setChecklist((prev) => {
            const updated = { ...prev };
            for (const item of CHECKLIST_ITEMS) {
              const suggested = item.subItems
                .filter((s) => data.checklistSuggestions.includes(s.id))
                .map((s) => s.id);
              if (suggested.length > 0) {
                updated[item.id] = [...new Set([...updated[item.id], ...suggested])];
              }
            }
            return updated;
          });
        }
      } catch (err) {
        setPhotoStates((prev) => ({
          ...prev,
          [section]: { status: "error", error: (err as Error).message },
        }));
      }
    },
    [pharmacyId, psVisitId]
  );

  const toggleSubItem = (itemId: string, subItemId: string) => {
    setIsDirty(true);
    setChecklist((prev) => {
      const current = prev[itemId] ?? [];
      return {
        ...prev,
        [itemId]: current.includes(subItemId)
          ? current.filter((s) => s !== subItemId)
          : [...current, subItemId],
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(
        `/api/pharmacies/${pharmacyId}/perfect-store/${psVisitId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checklistJson: checklist, notes }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Save failed");
      }
      onSaved();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const scoreBadgeColor =
    liveScore >= 80
      ? "bg-green-100 text-green-800"
      : liveScore >= 60
      ? "bg-amber-100 text-amber-800"
      : "bg-red-100 text-red-800";

  const sections = [...new Set(CHECKLIST_ITEMS.map((i) => i.section))] as ChecklistSection[];

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={() => onClose(isDirty)} />

      {/* Panel */}
      <div className="w-full max-w-xl bg-white shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between bg-amber-50">
          <div>
            <h2 className="text-base font-semibold text-gray-900">New Perfect Store Audit</h2>
            <p className="text-xs text-gray-500 mt-0.5">Upload shelf photos then complete the checklist</p>
          </div>
          <button onClick={() => onClose(isDirty)} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Section 1: Shelf Photos */}
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Camera className="w-4 h-4 text-amber-500" />
              Shelf Photos
            </h3>
            <div className="space-y-3">
              {SHELF_SECTIONS.map((section) => {
                const state = photoStates[section.id];
                const isExpanded = expandedReport === section.id;
                const a = state.analysis;

                return (
                  <div
                    key={section.id}
                    className={cn(
                      "rounded-lg border-2 transition-colors overflow-hidden",
                      state.status === "done"
                        ? "border-green-300 bg-green-50"
                        : state.status === "error"
                        ? "border-red-300 bg-red-50"
                        : state.status === "uploading"
                        ? "border-amber-300 bg-amber-50"
                        : "border-gray-200 bg-white"
                    )}
                  >
                    {/* Upload trigger row */}
                    <input
                      ref={fileRefs[section.id]}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(section.id, file);
                        e.target.value = "";
                      }}
                    />
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <button
                        onClick={() => fileRefs[section.id].current?.click()}
                        disabled={state.status === "uploading"}
                        className="flex items-center gap-2 flex-1 text-left"
                      >
                        {state.status === "uploading" ? (
                          <Loader2 className="w-4 h-4 text-amber-500 animate-spin flex-shrink-0" />
                        ) : state.status === "done" ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                        ) : state.status === "error" ? (
                          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        ) : (
                          <Upload className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800">{section.label}</p>
                          {state.status === "idle" && (
                            <p className="text-xs text-gray-400">{section.description}</p>
                          )}
                          {state.status === "uploading" && (
                            <p className="text-xs text-amber-600">Analysing…</p>
                          )}
                          {state.status === "error" && (
                            <p className="text-xs text-red-600">{state.error}</p>
                          )}
                          {state.status === "done" && a && (
                            <p className="text-xs text-green-700 font-medium">
                              Score {a.overallScore}/10 — tap to re-upload
                            </p>
                          )}
                        </div>
                      </button>

                      {/* Expand/collapse toggle for done state */}
                      {state.status === "done" && a && (
                        <button
                          onClick={() => setExpandedReport(isExpanded ? null : section.id)}
                          className="flex items-center gap-1 text-xs text-green-700 font-medium flex-shrink-0 hover:text-green-900"
                        >
                          Report
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Expanded report */}
                    {state.status === "done" && a && isExpanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-green-200 space-y-2">
                        <p className="text-xs text-gray-700 leading-relaxed">{a.summary}</p>

                        {a.stockouts.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-red-700 mb-0.5">Stockouts</p>
                            <ul className="text-xs text-red-600 space-y-0.5">
                              {a.stockouts.map((s, i) => <li key={i}>• {s}</li>)}
                            </ul>
                          </div>
                        )}
                        {a.lowStock.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-amber-700 mb-0.5">Low stock</p>
                            <ul className="text-xs text-amber-600 space-y-0.5">
                              {a.lowStock.map((s, i) => <li key={i}>• {s}</li>)}
                            </ul>
                          </div>
                        )}
                        {a.planogramIssues.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-700 mb-0.5">Planogram issues</p>
                            <ul className="text-xs text-gray-600 space-y-0.5">
                              {a.planogramIssues.map((s, i) => <li key={i}>• {s}</li>)}
                            </ul>
                          </div>
                        )}
                        {a.competitorPresence.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-700 mb-0.5">Competitors</p>
                            <p className="text-xs text-gray-600">{a.competitorPresence.join(", ")}</p>
                          </div>
                        )}
                        {a.recommendations.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-blue-700 mb-0.5">Recommendations</p>
                            <ul className="text-xs text-blue-600 space-y-0.5">
                              {a.recommendations.map((s, i) => <li key={i}>• {s}</li>)}
                            </ul>
                          </div>
                        )}

                        {/* KPIs */}
                        {Object.keys(a.kpis).length > 0 && (
                          <div className="grid grid-cols-3 gap-1.5 pt-1">
                            {Object.entries(a.kpis).map(([k, v]) => (
                              <div key={k} className="bg-white rounded p-1.5 text-center border border-green-200">
                                <p className="text-gray-500 leading-tight" style={{ fontSize: "10px" }}>
                                  {k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                                </p>
                                <p className="text-xs font-bold text-gray-800 mt-0.5">
                                  {v !== null ? v : "—"}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: PICOS Checklist */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800">PICOS Checklist</h3>
              <span className={cn("text-xs font-bold px-2.5 py-0.5 rounded-full", scoreBadgeColor)}>
                {liveScore} / 100
              </span>
            </div>

            <div className="space-y-4">
              {sections.map((section) => (
                <div key={section}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {SECTION_LABELS[section]}
                  </p>
                  <div className="space-y-3">
                    {CHECKLIST_ITEMS.filter((i) => i.section === section).map((item) => (
                      <div key={item.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-start gap-1 flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800">
                              <span className="text-gray-400 mr-1">#{item.num}</span>
                              {item.label}
                            </p>
                            {item.id === "item_2" && <PlanogramGuideButton />}
                          </div>
                          <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                            {item.maxPoints} pts
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {item.subItems.map((sub) => {
                            const checked = checklist[item.id]?.includes(sub.id) ?? false;
                            const isSuggested = allSuggestions.includes(sub.id);
                            return (
                              <label
                                key={sub.id}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleSubItem(item.id, sub.id)}
                                  className="w-3.5 h-3.5 rounded border-gray-300 text-amber-500 focus:ring-amber-400"
                                />
                                <span
                                  className={cn(
                                    "text-xs flex-1",
                                    checked ? "text-gray-900 font-medium" : "text-gray-500"
                                  )}
                                >
                                  {sub.label}
                                </span>
                                {isSuggested && !checked && (
                                  <span className="text-xs text-amber-500 font-medium">AI ✦</span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-4 bg-white space-y-3">
          <textarea
            placeholder="Notes (optional)…"
            value={notes}
            onChange={(e) => { setIsDirty(true); setNotes(e.target.value); }}
            rows={2}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          {saveError && (
            <p className="text-xs text-red-600">{saveError}</p>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save Audit"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
