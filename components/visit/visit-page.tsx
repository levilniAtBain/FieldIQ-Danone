"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Session } from "@/lib/auth/session";
import {
  ArrowLeft,
  Camera,
  Mic,
  MicOff,
  CheckCircle,
  Loader2,
  AlertCircle,
  ChevronRight,
  X,
} from "lucide-react";
import type { ShelfAnalysisResult, VoiceSummaryResult, ObjectivesEvaluationResult } from "@/lib/ai/claude";
import { OrderBuilder } from "./order-builder";

type Step = "prep" | "capture" | "complete";

type Pharmacy = {
  id: string;
  name: string;
  city: string;
  pharmacistName: string | null;
  tier: string;
  segment: string | null;
};

type VisitState = {
  visitId: string | null;
  notes: string;
  objectives: string[];
  shelfAnalysis: ShelfAnalysisResult | null;
  voiceSummary: VoiceSummaryResult | null;
  audioTranscript: string | null;
  orderId: string | null;
  orderTotal: number | null;
  aiReportDraft: string | null;
};

type ExistingVisit = {
  visitId: string;
  status: string;
  notes: string;
  objectives: string[];
  shelfAnalysis: ShelfAnalysisResult | null;
  voiceSummary: VoiceSummaryResult | null;
  audioTranscript: string | null;
  orderId: string | null;
  orderTotal: number | null;
  aiReportDraft: string | null;
};

export function VisitPage({
  pharmacy,
  session,
  existingVisit,
}: {
  pharmacy: Pharmacy;
  session: Session;
  existingVisit?: ExistingVisit;
}) {
  const router = useRouter();
  // When reopening an existing visit, jump straight to capture
  const [step, setStep] = useState<Step>(existingVisit ? "capture" : "prep");
  const [visitState, setVisitState] = useState<VisitState>({
    visitId: existingVisit?.visitId ?? null,
    notes: existingVisit?.notes ?? "",
    objectives: existingVisit?.objectives ?? [],
    shelfAnalysis: existingVisit?.shelfAnalysis ?? null,
    voiceSummary: existingVisit?.voiceSummary ?? null,
    audioTranscript: existingVisit?.audioTranscript ?? null,
    orderId: existingVisit?.orderId ?? null,
    orderTotal: existingVisit?.orderTotal ?? null,
    aiReportDraft: existingVisit?.aiReportDraft ?? null,
  });
  const [reopening, setReopening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newObjective, setNewObjective] = useState("");

  // If existing visit was completed, reopen it on mount
  useEffect(() => {
    if (existingVisit && existingVisit.status === "completed") {
      setReopening(true);
      fetch(`/api/visits/${existingVisit.visitId}/reopen`, { method: "POST" })
        .finally(() => setReopening(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Start visit on server ────────────────────────────────────────────────
  async function startVisit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pharmacyId: pharmacy.id,
          objectives: visitState.objectives,
        }),
      });
      if (!res.ok) throw new Error("Failed to create visit");
      const data = await res.json();
      setVisitState((s) => ({ ...s, visitId: data.visitId }));
      setStep("capture");
    } catch {
      setError("Could not start visit. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Back */}
      <Link
        href={`/pharmacies/${pharmacy.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={15} /> {pharmacy.name}
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-xs text-gray-400 uppercase tracking-wide">
            {existingVisit ? "Reopened visit" : "Active visit"}
          </p>
          {reopening && (
            <span className="text-xs text-brand-500 flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" /> Reopening…
            </span>
          )}
        </div>
        <h1 className="text-xl font-semibold text-gray-900">{pharmacy.name}</h1>
        <p className="text-sm text-gray-500">{pharmacy.city}</p>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mt-4">
          {(["prep", "capture", "complete"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                  step === s
                    ? "bg-brand-600 text-white"
                    : i < ["prep", "capture", "complete"].indexOf(step)
                    ? "bg-success-500 text-white"
                    : "bg-gray-100 text-gray-400"
                )}
              >
                {i < ["prep", "capture", "complete"].indexOf(step) ? (
                  <CheckCircle size={14} />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={cn(
                  "text-xs capitalize",
                  step === s ? "text-gray-900 font-medium" : "text-gray-400"
                )}
              >
                {s === "prep" ? "Preparation" : s === "capture" ? "Visit capture" : "Complete"}
              </span>
              {i < 2 && <ChevronRight size={12} className="text-gray-300" />}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-danger-50 border border-danger-100 text-danger-700 rounded-xl px-4 py-3 text-sm">
          <AlertCircle size={15} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X size={14} />
          </button>
        </div>
      )}

      {step === "prep" && (
        <PrepStep
          pharmacyId={pharmacy.id}
          objectives={visitState.objectives}
          newObjective={newObjective}
          setNewObjective={setNewObjective}
          onAddObjective={() => {
            if (newObjective.trim()) {
              setVisitState((s) => ({
                ...s,
                objectives: [...s.objectives, newObjective.trim()],
              }));
              setNewObjective("");
            }
          }}
          onAddObjectives={(objs) =>
            setVisitState((s) => ({
              ...s,
              objectives: [...s.objectives, ...objs.filter((o) => !s.objectives.includes(o))],
            }))
          }
          onRemoveObjective={(idx) =>
            setVisitState((s) => ({
              ...s,
              objectives: s.objectives.filter((_, i) => i !== idx),
            }))
          }
          onStart={startVisit}
          loading={loading}
        />
      )}

      {step === "capture" && visitState.visitId && (
        <CaptureStep
          visitId={visitState.visitId}
          pharmacy={pharmacy}
          visitState={visitState}
          setVisitState={setVisitState}
          onComplete={() => setStep("complete")}
        />
      )}

      {step === "complete" && visitState.visitId && (
        <CompleteStep
          visitId={visitState.visitId}
          pharmacy={pharmacy}
          session={session}
          visitState={visitState}
          setVisitState={setVisitState}
          onDone={() => router.push(`/pharmacies/${pharmacy.id}`)}
        />
      )}
    </div>
  );
}

// ── Step 1: Preparation ───────────────────────────────────────────────────────

function PrepStep({
  pharmacyId,
  objectives,
  newObjective,
  setNewObjective,
  onAddObjective,
  onAddObjectives,
  onRemoveObjective,
  onStart,
  loading,
}: {
  pharmacyId: string;
  objectives: string[];
  newObjective: string;
  setNewObjective: (v: string) => void;
  onAddObjective: () => void;
  onAddObjectives: (objs: string[]) => void;
  onRemoveObjective: (idx: number) => void;
  onStart: () => void;
  loading: boolean;
}) {
  const [suggested, setSuggested] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);

  useEffect(() => {
    fetch(`/api/pharmacies/${pharmacyId}/suggested-objectives`)
      .then((r) => r.json())
      .then((data: string[]) => {
        if (Array.isArray(data) && data.length > 0) {
          // Auto-add all suggestions as starting objectives
          onAddObjectives(data);
          setSuggested(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSuggestions(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900 mb-1">
              Visit objectives
            </p>
            <p className="text-xs text-gray-400">
              Pre-filled by AI from account briefing. Edit as needed.
            </p>
          </div>
          {loadingSuggestions && (
            <span className="flex items-center gap-1 text-xs text-brand-500">
              <Loader2 size={11} className="animate-spin" /> AI loading…
            </span>
          )}
          {!loadingSuggestions && suggested.length > 0 && (
            <span className="text-xs bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full">
              AI suggested
            </span>
          )}
        </div>

        {objectives.length > 0 && (
          <ul className="space-y-1.5">
            {objectives.map((obj, i) => (
              <li
                key={i}
                className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 text-sm"
              >
                <span className="flex-1 text-gray-700">{obj}</span>
                <button
                  onClick={() => onRemoveObjective(i)}
                  className="text-gray-300 hover:text-gray-500"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <input
            value={newObjective}
            onChange={(e) => setNewObjective(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAddObjective()}
            placeholder="Add a custom objective…"
            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
          <button
            onClick={onAddObjective}
            disabled={!newObjective.trim()}
            className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700 disabled:opacity-40 transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      <button
        onClick={onStart}
        disabled={loading || loadingSuggestions}
        className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white font-medium py-3 rounded-2xl hover:bg-brand-700 disabled:opacity-60 transition-colors"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : null}
        Start visit
      </button>
      {loadingSuggestions && (
        <p className="text-xs text-center text-gray-400">Loading AI objectives…</p>
      )}
    </div>
  );
}

// ── Step 2: Capture ───────────────────────────────────────────────────────────

function CaptureStep({
  visitId,
  pharmacy,
  visitState,
  setVisitState,
  onComplete,
}: {
  visitId: string;
  pharmacy: Pharmacy;
  visitState: VisitState;
  setVisitState: React.Dispatch<React.SetStateAction<VisitState>>;
  onComplete: () => void;
}) {
  const [captureTab, setCaptureTab] = useState<"objectives" | "shelf" | "voice" | "order" | "notes">("objectives");

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl text-xs">
        {([
          { id: "objectives", icon: "🎯", label: "Objectives" },
          { id: "shelf",      icon: "📷", label: "Shelf" },
          { id: "voice",      icon: "🎙", label: "Voice" },
          { id: "order",      icon: "🛒", label: "Order" },
          { id: "notes",      icon: "📝", label: "Notes" },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setCaptureTab(t.id)}
            className={cn(
              "flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all font-medium",
              captureTab === t.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <span>{t.icon}</span>
            <span className="hidden md:block text-xs">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Always render all panels; hide inactive ones so state is preserved */}
      <div className={captureTab === "objectives" ? "" : "hidden"}>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-900 mb-3">Visit objectives</p>
          {visitState.objectives.length === 0 ? (
            <p className="text-sm text-gray-400">No objectives were set for this visit.</p>
          ) : (
            <ul className="space-y-2">
              {visitState.objectives.map((obj, i) => (
                <li key={i} className="flex items-start gap-3 bg-brand-50 rounded-xl px-3 py-2.5">
                  <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 text-brand-600 text-xs font-semibold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="text-sm text-brand-900">{obj}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={captureTab === "shelf" ? "" : "hidden"}>
        <ShelfCaptureCard
          visitId={visitId}
          onResult={(r) => setVisitState((s) => ({ ...s, shelfAnalysis: r }))}
        />
      </div>

      <div className={captureTab === "voice" ? "" : "hidden"}>
        <VoiceNoteCard
          visitId={visitId}
          pharmacy={pharmacy}
          result={visitState.voiceSummary}
          onResult={(r) => setVisitState((s) => ({ ...s, voiceSummary: r }))}
        />
      </div>

      <div className={captureTab === "order" ? "" : "hidden"}>
        <OrderBuilder
          visitId={visitId}
          pharmacyName={pharmacy.name}
          existingVoiceTranscript={
            visitState.audioTranscript ?? visitState.voiceSummary?.summary ?? null
          }
          existingOrderId={visitState.orderId}
          existingOrderTotal={visitState.orderTotal}
          onOrderCreated={(oid, total) =>
            setVisitState((s) => ({ ...s, orderId: oid, orderTotal: total }))
          }
        />
      </div>

      <div className={captureTab === "notes" ? "" : "hidden"}>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm font-medium text-gray-900 mb-2">Visit notes</p>
          <textarea
            value={visitState.notes}
            onChange={(e) => setVisitState((s) => ({ ...s, notes: e.target.value }))}
            placeholder="Add free-text notes…"
            rows={6}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none"
          />
        </div>
      </div>

      <button
        onClick={onComplete}
        className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white font-medium py-3 rounded-2xl hover:bg-brand-700 transition-colors"
      >
        Complete visit
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

// ── Shelf photo capture card (multi-photo) ────────────────────────────────────

type ShelfPhoto = {
  fileId: string | null; // null while uploading
  preview: string;       // data URL (new) or /api/files/[id] (loaded)
  analysis: ShelfAnalysisResult | null;
  analyzing: boolean;
  error: string | null;
  expanded: boolean;
};

function ShelfCaptureCard({
  visitId,
  onResult,
}: {
  visitId: string;
  onResult: (r: ShelfAnalysisResult) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<ShelfPhoto[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(true);

  // Load existing photos from the server on mount
  useEffect(() => {
    fetch(`/api/visits/${visitId}/shelf-photos`)
      .then((r) => r.json())
      .then((data: Array<{ id: string; mimeType: string | null; aiAnalysisJson: unknown; createdAt: string }>) => {
        if (Array.isArray(data)) {
          setPhotos(
            data.map((p) => ({
              fileId: p.id,
              preview: `/api/files/${p.id}`,
              analysis: (p.aiAnalysisJson as ShelfAnalysisResult) ?? null,
              analyzing: false,
              error: null,
              expanded: false,
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoadingExisting(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Compress and convert any image (including HEIC from iOS) to JPEG via canvas.
   * Returns { dataUrl, base64, mimeType } with a max dimension of 1920px.
   */
  function compressImage(file: File): Promise<{ dataUrl: string; base64: string; mimeType: "image/jpeg" }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 1920;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        URL.revokeObjectURL(url);
        resolve({ dataUrl, base64: dataUrl.split(",")[1], mimeType: "image/jpeg" });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
      img.src = url;
    });
  }

  async function handleFile(file: File) {
    let dataUrl: string;
    let base64: string;
    let mimeType: "image/jpeg" | "image/png" | "image/webp";

    try {
      const compressed = await compressImage(file);
      dataUrl = compressed.dataUrl;
      base64 = compressed.base64;
      mimeType = compressed.mimeType;
    } catch {
      setPhotos((prev) => [
        ...prev,
        { fileId: null, preview: "", analysis: null, analyzing: false, error: "Could not read image", expanded: false },
      ]);
      return;
    }

    // Add placeholder while analyzing
    setPhotos((prev) => [
      ...prev,
      { fileId: null, preview: dataUrl, analysis: null, analyzing: true, error: null, expanded: false },
    ]);

    try {
      const res = await fetch(`/api/visits/${visitId}/analyze-shelf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Analysis failed (${res.status})`);
      }
      const data: { fileId: string; analysis: ShelfAnalysisResult } = await res.json();

      setPhotos((prev) =>
        prev.map((p) =>
          p.fileId === null && p.preview === dataUrl
            ? { ...p, fileId: data.fileId, analysis: data.analysis, analyzing: false, expanded: true }
            : p
        )
      );
      onResult(data.analysis);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analysis failed";
      setPhotos((prev) =>
        prev.map((p) =>
          p.fileId === null && p.preview === dataUrl
            ? { ...p, analyzing: false, error: msg }
            : p
        )
      );
    }
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function toggleExpand(idx: number) {
    setPhotos((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, expanded: !p.expanded } : p))
    );
  }

  const totalScore =
    photos.filter((p) => p.analysis).length > 0
      ? Math.round(
          photos.reduce((sum, p) => sum + (p.analysis?.overallScore ?? 0), 0) /
            photos.filter((p) => p.analysis).length
        )
      : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera size={16} className="text-brand-600" />
          <p className="text-sm font-medium text-gray-900">Shelf photos</p>
          {photos.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              {photos.length}
            </span>
          )}
        </div>
        {totalScore !== null && (
          <span className="text-xs bg-success-50 text-success-600 px-2 py-0.5 rounded-full font-medium">
            Avg {totalScore}/10
          </span>
        )}
      </div>

      {/* Photo grid */}
      {loadingExisting ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
          <Loader2 size={14} className="animate-spin" /> Loading photos…
        </div>
      ) : (
        <div className="space-y-3">
          {photos.map((photo, idx) => (
            <div key={photo.fileId ?? `tmp-${idx}`} className="border border-gray-100 rounded-xl overflow-hidden">
              {/* Thumbnail row */}
              <button
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
                onClick={() => toggleExpand(idx)}
              >
                <img
                  src={photo.preview}
                  alt={`Shelf ${idx + 1}`}
                  className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">Photo {idx + 1}</p>
                  {photo.analyzing && (
                    <span className="flex items-center gap-1 text-xs text-brand-500">
                      <Loader2 size={11} className="animate-spin" /> Analyzing…
                    </span>
                  )}
                  {photo.error && (
                    <span className="text-xs text-danger-600">{photo.error}</span>
                  )}
                  {photo.analysis && !photo.analyzing && (
                    <span className="text-xs text-gray-500 line-clamp-1">{photo.analysis.summary}</span>
                  )}
                </div>
                {photo.analysis && (
                  <span className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0",
                    photo.analysis.overallScore >= 7
                      ? "bg-success-50 text-success-600"
                      : photo.analysis.overallScore >= 4
                      ? "bg-yellow-50 text-yellow-700"
                      : "bg-danger-50 text-danger-600"
                  )}>
                    {photo.analysis.overallScore}/10
                  </span>
                )}
              </button>

              {/* Expanded analysis */}
              {photo.expanded && photo.analysis && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3">
                  <img
                    src={photo.preview}
                    alt={`Shelf ${idx + 1} full`}
                    className="w-full max-h-64 object-contain rounded-lg bg-gray-50"
                  />
                  <p className="text-sm text-gray-700">{photo.analysis.summary}</p>
                  {photo.analysis.stockouts.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-danger-600 mb-1">Stockouts</p>
                      <ul className="text-xs text-gray-600 space-y-0.5">
                        {photo.analysis.stockouts.map((s, i) => <li key={i}>• {s}</li>)}
                      </ul>
                    </div>
                  )}
                  {photo.analysis.lowStock.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-yellow-700 mb-1">Low stock</p>
                      <ul className="text-xs text-gray-600 space-y-0.5">
                        {photo.analysis.lowStock.map((s, i) => <li key={i}>• {s}</li>)}
                      </ul>
                    </div>
                  )}
                  {photo.analysis.competitorPresence.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1">Competitors</p>
                      <ul className="text-xs text-gray-600 space-y-0.5">
                        {photo.analysis.competitorPresence.map((s, i) => <li key={i}>• {s}</li>)}
                      </ul>
                    </div>
                  )}
                  {photo.analysis.planogramIssues.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-orange-600 mb-1">Planogram issues</p>
                      <ul className="text-xs text-gray-600 space-y-0.5">
                        {photo.analysis.planogramIssues.map((s, i) => <li key={i}>• {s}</li>)}
                      </ul>
                    </div>
                  )}
                  {photo.analysis.recommendations.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-brand-700 mb-1">Recommendations</p>
                      <ul className="text-xs text-gray-600 space-y-0.5">
                        {photo.analysis.recommendations.map((r, i) => <li key={i}>→ {r}</li>)}
                      </ul>
                    </div>
                  )}
                  <a
                    href={photo.fileId ? `/api/files/${photo.fileId}` : photo.preview}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Open full image ↗
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add photo button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-4 text-gray-400 hover:border-brand-300 hover:text-brand-500 transition-colors text-sm"
      >
        <Camera size={18} />
        {photos.length === 0 ? "Take or upload a shelf photo" : "Add another photo"}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}

// ── Voice note card ───────────────────────────────────────────────────────────

function VoiceNoteCard({
  visitId,
  pharmacy,
  result,
  onResult,
}: {
  visitId: string;
  pharmacy: Pharmacy;
  result: VoiceSummaryResult | null;
  onResult: (r: VoiceSummaryResult) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingMore, setAddingMore] = useState(false);
  // Accumulates raw text from all recordings for combined re-summarization
  const accumulatedRef = useRef("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const stopRecording = useCallback(async (newTranscript: string) => {
    setRecording(false);
    if (!newTranscript.trim()) {
      setAddingMore(false);
      return;
    }

    // Combine with any previous recordings
    const combined = accumulatedRef.current
      ? accumulatedRef.current + "\n\n" + newTranscript
      : newTranscript;

    setSummarizing(true);
    setError(null);
    try {
      const res = await fetch(`/api/visits/${visitId}/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: combined,
          pharmacyName: pharmacy.name,
        }),
      });
      if (!res.ok) throw new Error("Summarization failed");
      const data = await res.json();
      accumulatedRef.current = combined;
      onResult(data);
      setAddingMore(false);
    } catch {
      setError("Summarization failed. Your notes are saved as text.");
    } finally {
      setSummarizing(false);
    }
  }, [visitId, pharmacy.name, onResult]);

  function startRecording() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRecognitionAPI = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setError("Speech recognition not supported in this browser. Use Chrome or Edge.");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new SpeechRecognitionAPI() as any;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let fullTranscript = "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          fullTranscript += t + " ";
        } else {
          interim = t;
        }
      }
      setTranscript(fullTranscript + interim);
    };

    recognition.onerror = () => {
      setError("Microphone error. Check permissions.");
      setRecording(false);
    };

    recognition.onend = () => {
      stopRecording(fullTranscript);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
    setTranscript("");
    setError(null);
  }

  function handleStop() {
    recognitionRef.current?.stop();
  }

  const showRecordingUI = !result || addingMore;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Mic size={16} className="text-brand-600" />
          <p className="text-sm font-medium text-gray-900">Voice notes</p>
        </div>
        {result && (
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded-full font-medium",
              result.sentiment === "positive"
                ? "bg-success-50 text-success-600"
                : result.sentiment === "negative"
                ? "bg-danger-50 text-danger-600"
                : "bg-gray-100 text-gray-600"
            )}
          >
            {result.sentiment}
          </span>
        )}
      </div>

      {result && (
        <div className="space-y-3 mb-3">
          <p className="text-sm text-gray-700">{result.summary}</p>
          {result.keyPoints.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Key points</p>
              <ul className="text-xs text-gray-600 space-y-0.5">
                {result.keyPoints.map((p, i) => <li key={i}>• {p}</li>)}
              </ul>
            </div>
          )}
          {result.actions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-brand-700 mb-1">Follow-up actions</p>
              <ul className="text-xs text-gray-600 space-y-0.5">
                {result.actions.map((a, i) => <li key={i}>→ {a}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {showRecordingUI && !summarizing && (
        <div className="space-y-3">
          {addingMore && (
            <p className="text-xs text-gray-500">Recording will be merged with previous notes.</p>
          )}
          <button
            onClick={recording ? handleStop : startRecording}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-colors",
              recording
                ? "bg-danger-500 text-white hover:bg-danger-600"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            {recording ? (
              <>
                <MicOff size={16} /> Stop recording
              </>
            ) : (
              <>
                <Mic size={16} /> {addingMore ? "Start new recording" : "Start recording"}
              </>
            )}
          </button>

          {recording && transcript && (
            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 max-h-24 overflow-y-auto">
              {transcript}
            </div>
          )}

          {addingMore && !recording && (
            <button
              onClick={() => setAddingMore(false)}
              className="w-full text-xs text-gray-400 hover:text-gray-600 py-1"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {result && !addingMore && !summarizing && (
        <button
          onClick={() => setAddingMore(true)}
          className="mt-2 flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 font-medium"
        >
          <Mic size={12} /> Add another recording
        </button>
      )}

      {summarizing && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
          <Loader2 size={15} className="animate-spin text-brand-500" />
          Summarizing with AI…
        </div>
      )}

      {error && (
        <p className="text-xs text-danger-600 mt-2 flex items-center gap-1">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
}


// ── Step 3: Complete ──────────────────────────────────────────────────────────

function CompleteStep({
  visitId,
  pharmacy,
  session,
  visitState,
  setVisitState,
  onDone,
}: {
  visitId: string;
  pharmacy: Pharmacy;
  session: Session;
  visitState: VisitState;
  setVisitState: React.Dispatch<React.SetStateAction<VisitState>>;
  onDone: () => void;
}) {
  // Pre-fill with existing draft if reopening a visit
  const [report, setReport] = useState(visitState.aiReportDraft ?? "");
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(!!visitState.aiReportDraft);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<ObjectivesEvaluationResult | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  useEffect(() => {
    async function run() {
      // Evaluate objectives if any were set
      if (visitState.objectives.length > 0) {
        setEvaluating(true);
        try {
          const res = await fetch(`/api/visits/${visitId}/evaluate-objectives`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              objectives: visitState.objectives,
              notes: visitState.notes || null,
              voiceSummary: visitState.voiceSummary,
              shelfAnalysis: visitState.shelfAnalysis,
              orderPlaced: visitState.orderId !== null,
              orderTotal: visitState.orderTotal,
            }),
          });
          if (res.ok) setEvaluation(await res.json());
        } catch { /* non-blocking */ }
        finally { setEvaluating(false); }
      }
      // Only auto-generate report if no existing draft
      if (!visitState.aiReportDraft) {
        generateReport();
      }
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generateReport() {
    setGenerating(true);
    setError(null);
    setReport("");

    try {
      const res = await fetch(`/api/visits/${visitId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: visitState.notes,
          objectives: visitState.objectives,
          pharmacyName: pharmacy.name,
          orderPlaced: visitState.orderId !== null,
          orderTotal: visitState.orderTotal,
        }),
      });

      if (!res.ok) throw new Error("Report generation failed");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No stream");

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        const chunk = decoder.decode(value, { stream: true });
        setReport((prev) => prev + chunk);
      }
      setDone(true);
    } catch {
      setError("Report generation failed. Your visit has been saved.");
      setDone(true);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle size={16} className="text-success-500" />
          <p className="text-sm font-semibold text-gray-900">Visit complete</p>
        </div>

        {/* Summary badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          {visitState.objectives.length > 0 && (
            <span className="text-xs bg-brand-50 text-brand-700 px-2 py-1 rounded-full">
              {visitState.objectives.length} objective{visitState.objectives.length !== 1 ? "s" : ""}
            </span>
          )}
          {visitState.shelfAnalysis && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
              Shelf {visitState.shelfAnalysis.overallScore}/10
            </span>
          )}
          {visitState.voiceSummary && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
              Voice notes
            </span>
          )}
          {visitState.orderId && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
              Order: €{visitState.orderTotal?.toFixed(2) ?? "—"}
            </span>
          )}
        </div>

        {/* Objectives evaluation */}
        {visitState.objectives.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Objectives evaluation
            </p>
            {evaluating && (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                <Loader2 size={13} className="animate-spin" /> Evaluating objectives…
              </div>
            )}
            {evaluation && (
              <div className="space-y-2">
                {evaluation.evaluations.map((ev, i) => (
                  <div key={i} className="flex gap-3 items-start bg-gray-50 rounded-xl px-3 py-2.5">
                    <span className={cn(
                      "mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-white text-xs",
                      ev.status === "met" ? "bg-success-500" :
                      ev.status === "partial" ? "bg-yellow-400" : "bg-danger-400"
                    )}>
                      {ev.status === "met" ? "✓" : ev.status === "partial" ? "~" : "✗"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800">{ev.objective}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{ev.evidence}</p>
                    </div>
                  </div>
                ))}
                <div className={cn(
                  "text-xs px-3 py-2 rounded-xl font-medium flex items-center justify-between",
                  evaluation.score >= 7 ? "bg-success-50 text-success-700" :
                  evaluation.score >= 4 ? "bg-yellow-50 text-yellow-700" :
                  "bg-danger-50 text-danger-700"
                )}>
                  <span>{evaluation.overallAssessment}</span>
                  <span>{evaluation.score}/10</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI Report */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            AI Visit Report
          </p>
          {generating && !report && (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
              <Loader2 size={14} className="animate-spin" />
              Generating report…
            </div>
          )}
          {report && (
            <textarea
              value={report}
              onChange={(e) => setReport(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none"
            />
          )}
          {generating && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
              <Loader2 size={11} className="animate-spin" />
              Writing…
            </div>
          )}
        </div>

        {error && (
          <p className="text-xs text-danger-600 mt-2 flex items-center gap-1">
            <AlertCircle size={12} /> {error}
          </p>
        )}
      </div>

      {done && (
        <button
          onClick={onDone}
          className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white font-medium py-3 rounded-2xl hover:bg-brand-700 transition-colors"
        >
          <CheckCircle size={16} />
          Back to pharmacy
        </button>
      )}
    </div>
  );
}
