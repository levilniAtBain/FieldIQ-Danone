"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";

export function AiBriefing({ pharmacyId }: { pharmacyId: string }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function load() {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setText("");
    setLoaded(false);

    try {
      const res = await fetch(`/api/pharmacies/${pharmacyId}/briefing`, {
        signal: controller.signal,
      });
      if (res.status === 503) {
        setError("AI briefings require an ANTHROPIC_API_KEY in your .env file.");
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to load briefing");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No stream");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setText((prev) => prev + decoder.decode(value, { stream: true }));
      }
      setLoaded(true);
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") return;
      setError("Could not load briefing. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pharmacyId]);

  return (
    <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles size={13} className="text-brand-600" />
          <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide">
            AI Account Briefing
          </p>
        </div>
        {loaded && (
          <button
            onClick={load}
            className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-700"
          >
            <RefreshCw size={11} /> Refresh
          </button>
        )}
      </div>

      {loading && !text && (
        <div className="flex items-center gap-2 text-sm text-brand-600 py-1">
          <Loader2 size={13} className="animate-spin" />
          Generating briefing…
        </div>
      )}

      {text && (
        <div className="text-sm text-brand-900 whitespace-pre-line leading-relaxed">
          {text}
          {loading && (
            <span className="inline-block w-1.5 h-3.5 bg-brand-400 animate-pulse ml-0.5 align-middle" />
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-brand-700 opacity-70">{error}</p>
      )}
    </div>
  );
}
