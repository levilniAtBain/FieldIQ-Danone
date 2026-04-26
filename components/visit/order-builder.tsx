"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Sparkles,
  Download,
  CheckCircle,
  Plus,
  Minus,
  Trash2,
  AlertCircle,
  ScanLine,
  Mic,
  MicOff,
  FileText,
  Search,
  X,
  RefreshCw,
  BarChart2,
  Package,
} from "lucide-react";

export type OrderLine = {
  productId: string;
  sku: string;
  name: string;
  brand: string;
  quantity: number;
  unitPrice: number;
  source: "history" | "scan" | "voice" | "peer" | "manual";
  rationale?: string;
};

type Props = {
  visitId: string;
  pharmacyName: string;
  existingVoiceTranscript: string | null;
  existingOrderId?: string | null;
  existingOrderTotal?: number | null;
  onOrderCreated: (orderId: string, total: number) => void;
};

export function OrderBuilder({
  visitId,
  pharmacyName,
  existingVoiceTranscript,
  existingOrderId,
  existingOrderTotal,
  onOrderCreated,
}: Props) {
  // If an order already exists for this visit, jump to done state
  const [step, setStep] = useState<"input" | "review" | "done">(
    existingOrderId ? "done" : "input"
  );

  // Inputs
  const [typedNotes, setTypedNotes] = useState("");
  const [scannedItems, setScannedItems] = useState<
    Array<{ productName: string; sku: string | null; quantity: number }>
  >([]);

  // Voice
  const [recording, setRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState(existingVoiceTranscript ?? "");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // Scan
  const scanFileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);

  // AI result
  const [building, setBuilding] = useState(false);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [orderId, setOrderId] = useState<string | null>(existingOrderId ?? null);
  const [summary, setSummary] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [totalAmount, setTotalAmount] = useState(existingOrderTotal ?? 0);
  const [error, setError] = useState<string | null>(null);

  // Reorder
  const [reordering, setReordering] = useState(false);

  // CSV imports
  const selloutFileRef = useRef<HTMLInputElement>(null);
  const stockFileRef = useRef<HTMLInputElement>(null);
  const [selloutImporting, setSelloutImporting] = useState(false);
  const [stockImporting, setStockImporting] = useState(false);
  const [selloutResult, setSelloutResult] = useState<{ matched: number; unmatched: number; total: number } | null>(null);
  const [stockResult, setStockResult] = useState<{ matched: number; unmatched: number; total: number } | null>(null);

  // Manual product search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{
    id: string; sku: string; name: string; brand: string; category: string; unitPrice: string | null;
  }>>([]);
  const [searching, setSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // ── Reorder from last visit ─────────────────────────────────────────────
  async function handleReorder() {
    setReordering(true);
    setError(null);
    try {
      const res = await fetch(`/api/visits/${visitId}/reorder`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to load last order");
      }
      const data = await res.json();
      setOrderId(data.orderId);
      setLines(data.lines);
      setSummary(data.summary);
      setWarnings(data.warnings ?? []);
      setTotalAmount(data.totalAmount);
      setStep("review");
    } catch (e: unknown) {
      setError((e as Error).message || "Could not load previous order.");
    } finally {
      setReordering(false);
    }
  }

  // ── Manual product search ───────────────────────────────────────────────
  const searchProducts = useCallback((q: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchDebounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setSearchResults(data);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  function addProductManually(p: { id: string; sku: string; name: string; brand: string; unitPrice: string | null }) {
    const existing = lines.findIndex((l) => l.productId === p.id);
    let updated: OrderLine[];
    if (existing >= 0) {
      updated = lines.map((l, i) => i === existing ? { ...l, quantity: l.quantity + 1 } : l);
    } else {
      const price = parseFloat(p.unitPrice ?? "0") || 0;
      updated = [...lines, {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        brand: p.brand,
        quantity: 1,
        unitPrice: price,
        source: "manual" as const,
      }];
    }
    setLines(updated);
    setTotalAmount(updated.reduce((s, l) => s + l.quantity * l.unitPrice, 0));
    // Persist to DB if order exists
    if (orderId) {
      fetch(`/api/orders/${orderId}/lines`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: updated.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice })),
        }),
      });
    }
  }

  // ── Voice recording ─────────────────────────────────────────────────────
  function startVoice() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setError("Speech recognition not supported. Use Chrome or Edge.");
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new SR() as any;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "fr-FR";
    let full = existingVoiceTranscript ?? "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) full += t + " ";
        else interim = t;
      }
      setVoiceTranscript(full + interim);
    };
    rec.onerror = () => setRecording(false);
    rec.onend = () => setRecording(false);
    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
  }

  function stopVoice() {
    recognitionRef.current?.stop();
    setRecording(false);
  }

  // ── Order scan ──────────────────────────────────────────────────────────
  async function handleScanFile(file: File) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const base64 = dataUrl.split(",")[1];
      const mimeType = file.type as "image/jpeg" | "image/png" | "image/webp";
      setScanning(true);
      setError(null);
      try {
        const res = await fetch(`/api/visits/${visitId}/scan-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setScannedItems(data.lineItems ?? []);
      } catch {
        setError("Scan failed. You can type notes instead.");
      } finally {
        setScanning(false);
      }
    };
    reader.readAsDataURL(file);
  }

  // ── CSV imports ─────────────────────────────────────────────────────────
  async function handleImportCsv(file: File, type: "sellout" | "stock") {
    const setImporting = type === "sellout" ? setSelloutImporting : setStockImporting;
    const setResult = type === "sellout" ? setSelloutResult : setStockResult;
    setImporting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/visits/${visitId}/import-${type}`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult(data);
    } catch (e: unknown) {
      setError((e as Error).message || "Import failed. Check the CSV format.");
    } finally {
      setImporting(false);
    }
  }

  // ── AI build ────────────────────────────────────────────────────────────
  async function buildOrder() {
    setBuilding(true);
    setError(null);
    try {
      const res = await fetch(`/api/visits/${visitId}/build-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceTranscript: voiceTranscript || null,
          scannedItems,
          typedNotes: typedNotes || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed");
      }
      const data = await res.json();
      setOrderId(data.orderId);
      setLines(data.lines);
      setSummary(data.summary);
      setWarnings(data.warnings ?? []);
      setTotalAmount(data.totalAmount);
      setStep("review");
    } catch (e: unknown) {
      setError((e as Error).message || "AI order generation failed.");
    } finally {
      setBuilding(false);
    }
  }

  // ── Update a line quantity ──────────────────────────────────────────────
  async function updateQty(idx: number, delta: number) {
    const updated = lines.map((l, i) =>
      i === idx ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l
    ).filter((l) => l.quantity > 0);

    setLines(updated);
    const newTotal = updated.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    setTotalAmount(newTotal);

    if (!orderId) return;
    await fetch(`/api/orders/${orderId}/lines`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lines: updated.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
      }),
    });
  }

  // ── Submit order ────────────────────────────────────────────────────────
  async function submitOrder() {
    if (!orderId) return;
    setSubmitting(true);
    try {
      await fetch(`/api/orders/${orderId}/submit`, { method: "POST" });
      setSubmitted(true);
      setStep("done");
      onOrderCreated(orderId, totalAmount);
    } catch {
      setError("Submit failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Export CSV ──────────────────────────────────────────────────────────
  function exportCsv() {
    if (!orderId) return;
    window.open(`/api/orders/${orderId}/export`, "_blank");
  }

  // ────────────────────────────────────────────────────────────────────────
  if (step === "input") {
    return (
      <div className="space-y-4">
        {/* Voice notes */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-1.5">
            <Mic size={14} className="text-brand-500" /> Voice notes for order
          </p>
          {existingVoiceTranscript && (
            <p className="text-xs text-gray-400 mb-2">
              ✓ Using voice recording from visit capture
            </p>
          )}
          <button
            onClick={recording ? stopVoice : startVoice}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors",
              recording
                ? "bg-danger-500 text-white hover:bg-danger-600"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            {recording ? <><MicOff size={14} /> Stop</> : <><Mic size={14} /> {existingVoiceTranscript ? "Add more" : "Record"}</>}
          </button>
          {voiceTranscript && (
            <div className="mt-2 bg-gray-50 rounded-xl p-2.5 text-xs text-gray-600 max-h-20 overflow-y-auto">
              {voiceTranscript}
            </div>
          )}
        </div>

        {/* Scan handwritten notes */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-1.5">
            <ScanLine size={14} className="text-brand-500" /> Scan handwritten order
          </p>
          <button
            onClick={() => scanFileRef.current?.click()}
            disabled={scanning}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-6 text-gray-400 hover:border-brand-300 hover:text-brand-500 disabled:opacity-50 transition-colors text-sm"
          >
            {scanning ? (
              <><Loader2 size={15} className="animate-spin" /> Extracting…</>
            ) : (
              <><ScanLine size={18} /> Take photo of handwritten order</>
            )}
          </button>
          <input
            ref={scanFileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleScanFile(f);
            }}
          />
          {scannedItems.length > 0 && (
            <div className="mt-2 space-y-1">
              {scannedItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-2.5 py-1.5">
                  <span className="text-gray-700">{item.productName}</span>
                  <span className="font-medium text-gray-900">×{item.quantity}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Typed notes */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-1.5">
            <FileText size={14} className="text-brand-500" /> Typed notes
          </p>
          <textarea
            value={typedNotes}
            onChange={(e) => setTypedNotes(e.target.value)}
            placeholder={`e.g. "pharmacist wants 3 more Fortimel, skip Gallia this month, add Aptamil Pronutra"`}
            rows={3}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none"
          />
        </div>

        {/* Pharmacy data — sell-out & stock CSVs */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <p className="text-sm font-medium text-gray-900">Données pharmacie</p>
          <p className="text-xs text-gray-400">Importez les fichiers CSV exportés de Winpharma ou LGPI pour affiner les quantités de commande.</p>

          {/* Sell-out */}
          <div>
            <button
              onClick={() => selloutFileRef.current?.click()}
              disabled={selloutImporting}
              className="w-full flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2.5 text-sm hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50 transition-colors"
            >
              <span className="flex items-center gap-2 text-gray-700">
                <BarChart2 size={14} className="text-brand-500" />
                {selloutImporting ? "Import en cours…" : "Importer sell-out (.csv)"}
              </span>
              {selloutImporting && <Loader2 size={13} className="animate-spin text-gray-400" />}
            </button>
            <input
              ref={selloutFileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportCsv(f, "sellout"); e.target.value = ""; }}
            />
            {selloutResult && (
              <div className={cn("mt-1.5 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg",
                selloutResult.unmatched === 0 ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-700"
              )}>
                <CheckCircle size={11} />
                {selloutResult.total} lignes · {selloutResult.matched} matchées
                {selloutResult.unmatched > 0 && ` · ${selloutResult.unmatched} non reconnues`}
              </div>
            )}
          </div>

          {/* Stock */}
          <div>
            <button
              onClick={() => stockFileRef.current?.click()}
              disabled={stockImporting}
              className="w-full flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2.5 text-sm hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50 transition-colors"
            >
              <span className="flex items-center gap-2 text-gray-700">
                <Package size={14} className="text-brand-500" />
                {stockImporting ? "Import en cours…" : "Importer stock actuel (.csv)"}
              </span>
              {stockImporting && <Loader2 size={13} className="animate-spin text-gray-400" />}
            </button>
            <input
              ref={stockFileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportCsv(f, "stock"); e.target.value = ""; }}
            />
            {stockResult && (
              <div className={cn("mt-1.5 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg",
                stockResult.unmatched === 0 ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-700"
              )}>
                <CheckCircle size={11} />
                {stockResult.total} lignes · {stockResult.matched} matchées
                {stockResult.unmatched > 0 && ` · ${stockResult.unmatched} non reconnues`}
              </div>
            )}
          </div>
        </div>

        {/* Reorder divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100" /></div>
          <div className="relative flex justify-center">
            <span className="bg-gray-50 px-3 text-xs text-gray-400">or start from a previous order</span>
          </div>
        </div>

        <button
          onClick={handleReorder}
          disabled={reordering || building}
          className="w-full flex items-center justify-center gap-2 border border-gray-200 bg-white text-gray-700 font-medium py-3 rounded-2xl hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50 transition-colors text-sm"
        >
          {reordering ? (
            <><Loader2 size={14} className="animate-spin" /> Loading last order…</>
          ) : (
            <><RefreshCw size={14} /> Reorder from last visit</>
          )}
        </button>

        {error && (
          <p className="text-xs text-danger-600 flex items-center gap-1">
            <AlertCircle size={12} /> {error}
          </p>
        )}

        <button
          onClick={buildOrder}
          disabled={building || reordering}
          className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white font-medium py-3 rounded-2xl hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {building ? (
            <><Loader2 size={15} className="animate-spin" /> Building order with AI…</>
          ) : (
            <><Sparkles size={15} /> Generate order with AI</>
          )}
        </button>

        <p className="text-xs text-gray-400 text-center">
          L'IA utilise l'historique, les données sell-out/stock et les notes pour proposer les quantités
        </p>
      </div>
    );
  }

  if (step === "review") {
    const sourceBadge: Record<string, string> = {
      history: "bg-gray-100 text-gray-500",
      peer: "bg-blue-50 text-blue-600",
      voice: "bg-purple-50 text-purple-600",
      scan: "bg-orange-50 text-orange-600",
      manual: "bg-gray-100 text-gray-500",
    };

    return (
      <div className="space-y-4">
        {/* AI summary */}
        <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles size={13} className="text-brand-600" />
            <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide">AI Order Summary</p>
          </div>
          <p className="text-sm text-brand-900">{summary}</p>
        </div>

        {warnings.length > 0 && (
          <div className="bg-warning-50 border border-warning-100 rounded-xl p-3">
            <p className="text-xs font-semibold text-warning-700 mb-1">Could not match</p>
            <ul className="text-xs text-warning-700 space-y-0.5">
              {warnings.map((w, i) => <li key={i}>• {w}</li>)}
            </ul>
          </div>
        )}

        {/* Order lines */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">Order lines</p>
            <p className="text-xs text-gray-400">{lines.length} products</p>
          </div>
          <div className="divide-y divide-gray-50">
            {lines.map((line, i) => (
              <div key={line.productId} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-gray-900 font-medium truncate">{line.name}</p>
                    <span className={cn("text-xs px-1.5 py-0.5 rounded-full capitalize", sourceBadge[line.source])}>
                      {line.source}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{line.sku} · €{line.unitPrice.toFixed(2)}/unit</p>
                  {line.rationale && (
                    <p className="text-xs text-gray-400 italic">{line.rationale}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => updateQty(i, -1)}
                    className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                  >
                    {line.quantity === 1 ? <Trash2 size={12} className="text-danger-500" /> : <Minus size={12} />}
                  </button>
                  <span className="w-8 text-center text-sm font-semibold text-gray-900">
                    {line.quantity}
                  </span>
                  <button
                    onClick={() => updateQty(i, 1)}
                    className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                <div className="w-16 text-right flex-shrink-0">
                  <p className="text-sm font-medium text-gray-900">
                    €{(line.quantity * line.unitPrice).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50">
            <p className="text-sm font-semibold text-gray-700">Total</p>
            <p className="text-lg font-bold text-gray-900">€{totalAmount.toFixed(2)}</p>
          </div>
        </div>

        {/* Manual product add */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <button
            onClick={() => setShowSearch((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span className="flex items-center gap-2"><Plus size={14} className="text-brand-500" /> Add a product manually</span>
            {showSearch ? <X size={14} className="text-gray-400" /> : null}
          </button>
          {showSearch && (
            <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); searchProducts(e.target.value); }}
                  placeholder="Search by name, brand, SKU…"
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              {searching && <p className="text-xs text-gray-400 text-center py-1"><Loader2 size={12} className="inline animate-spin mr-1" />Searching…</p>}
              {searchResults.length > 0 && (
                <div className="space-y-1 max-h-52 overflow-y-auto">
                  {searchResults.map((p) => {
                    const inOrder = lines.find((l) => l.productId === p.id);
                    return (
                      <div key={p.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-900 truncate">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.sku} · {p.brand.replace(/_/g, " ")} · €{parseFloat(p.unitPrice ?? "0").toFixed(2)}</p>
                        </div>
                        <button
                          onClick={() => addProductManually(p)}
                          className="ml-2 flex-shrink-0 flex items-center gap-1 bg-brand-50 text-brand-700 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-brand-100 transition-colors"
                        >
                          <Plus size={12} />
                          {inOrder ? `×${inOrder.quantity}` : "Add"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {searchQuery.length > 0 && !searching && searchResults.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">No products found</p>
              )}
            </div>
          )}
        </div>

        {error && (
          <p className="text-xs text-danger-600 flex items-center gap-1">
            <AlertCircle size={12} /> {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={submitOrder}
            disabled={submitting || lines.length === 0}
            className="flex-1 flex items-center justify-center gap-2 bg-brand-600 text-white font-medium py-3 rounded-2xl hover:bg-brand-700 disabled:opacity-50 transition-colors text-sm"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            Submit order
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-gray-200 text-sm text-gray-600 hover:border-gray-300 transition-colors"
            title="Download CSV for Danone import"
          >
            <Download size={14} /> CSV
          </button>
        </div>
        <p className="text-xs text-gray-400 text-center">
          CSV export is compatible with Danone order import systems
        </p>
      </div>
    );
  }

  // Done
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center space-y-3">
      <CheckCircle size={32} className="mx-auto text-success-500" />
      <p className="text-sm font-semibold text-gray-900">
        {submitted ? "Order submitted" : "Order on file"}
      </p>
      {totalAmount > 0 && (
        <p className="text-sm text-gray-500">Total: €{totalAmount.toFixed(2)}</p>
      )}
      <div className="flex flex-col items-center gap-2">
        {orderId && (
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 text-sm text-brand-600 font-medium hover:underline"
          >
            <Download size={14} /> Download CSV for Danone import
          </button>
        )}
        <button
          onClick={() => { setStep("input"); setLines([]); setOrderId(null); setTotalAmount(0); }}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Rebuild order
        </button>
      </div>
    </div>
  );
}
