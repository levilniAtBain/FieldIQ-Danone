"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export const SEGMENT_CONFIG = {
  a: {
    label: "Seg A",
    name: "Strategic Partners",
    priority: 1,
    badge: "bg-teal-100 text-teal-800 border-teal-200",
    priorityBadge: "bg-teal-600 text-white",
    headerBg: "bg-teal-50 border-teal-200",
    pharmacies: "~2,000 pts",
    marketShare: "~20%",
    criteria: "High dermocosmetic turnover · Urban affluent",
    picos: "Full PICOS · PICOS tailored by commercial cycle",
    visitFreq: "Weekly",
    coverage: "Sales Reps + Merchandizer",
    brands: "La Roche-Posay · CeraVe · Vichy · Skinceuticals",
  },
  b: {
    label: "Seg B",
    name: "Core Pharmacies",
    priority: 2,
    badge: "bg-blue-100 text-blue-800 border-blue-200",
    priorityBadge: "bg-blue-600 text-white",
    headerBg: "bg-blue-50 border-blue-200",
    pharmacies: "~6,000 pts",
    marketShare: "~20%",
    criteria: "Medium potential · Independent · Suburban / mixed",
    picos: "Light PICOS – PICOS tailored by commercial cycle",
    visitFreq: "By-Weekly",
    coverage: "Sales Reps – Merchandizer on-need",
    brands: "La Roche-Posay · CeraVe · Vichy",
  },
  c: {
    label: "Seg C",
    name: "Development Pharmacies",
    priority: 3,
    badge: "bg-orange-100 text-orange-800 border-orange-200",
    priorityBadge: "bg-orange-500 text-white",
    headerBg: "bg-orange-50 border-orange-200",
    pharmacies: "~7,000 pts",
    marketShare: "~35%",
    criteria: "Low-medium potential · Mixed · Rural / periurban",
    picos: "Simplified PICOS · not tailored to commercial cycle",
    visitFreq: "Monthly",
    coverage: "Sales Reps",
    brands: "La Roche-Posay · CeraVe · Vichy",
  },
  d: {
    label: "Seg D",
    name: "Long-Tail / Self-Serve",
    priority: 4,
    badge: "bg-gray-200 text-gray-700 border-gray-300",
    priorityBadge: "bg-gray-600 text-white",
    headerBg: "bg-gray-50 border-gray-200",
    pharmacies: "~5,000 pts",
    marketShare: "~25%",
    criteria: "Low potential · Chains / grouped · Self-service model",
    picos: "PICOS sent to pharmacists",
    visitFreq: "Not Visited",
    coverage: "Not visited",
    brands: "La Roche-Posay · CeraVe · Vichy",
  },
} as const;

type Segment = keyof typeof SEGMENT_CONFIG;

const TOOLTIP_WIDTH = 256; // w-64

export function SegmentBadge({ tier, className }: { tier: string; className?: string }) {
  const seg = SEGMENT_CONFIG[tier?.toLowerCase() as Segment];
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  if (!seg) return null;

  function handleMouseEnter() {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2, 8),
      window.innerWidth - TOOLTIP_WIDTH - 8
    );
    setPos({ top: rect.bottom + 8, left });
  }

  function handleMouseLeave() {
    setPos(null);
  }

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "text-xs font-semibold px-2.5 py-0.5 rounded-full border cursor-default select-none",
          seg.badge,
          className
        )}
      >
        {seg.label}
      </span>

      {pos && (
        <div
          className="fixed z-[9999] w-64 pointer-events-none"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden text-left">
            {/* Header */}
            <div className={cn("px-3 py-2.5 border-b flex items-center justify-between", seg.headerBg)}>
              <div>
                <p className="text-xs font-bold text-gray-900">{seg.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{seg.label}</p>
              </div>
              <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", seg.priorityBadge)}>
                Priority {seg.priority}
              </span>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 divide-x divide-gray-100 border-b border-gray-100">
              <div className="px-3 py-2 text-center">
                <p className="text-xs font-bold text-gray-900">{seg.pharmacies}</p>
                <p className="text-xs text-gray-400">Pharmacies</p>
              </div>
              <div className="px-3 py-2 text-center">
                <p className="text-xs font-bold text-gray-900">{seg.marketShare}</p>
                <p className="text-xs text-gray-400">Market share</p>
              </div>
            </div>

            {/* Details */}
            <div className="px-3 py-2 space-y-1.5">
              {[
                { label: "Criteria",    value: seg.criteria },
                { label: "PICOS",       value: seg.picos },
                { label: "Visit freq.", value: seg.visitFreq },
                { label: "Coverage",    value: seg.coverage },
                { label: "LDB brands",  value: seg.brands },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-2">
                  <span className="text-xs text-gray-400 w-16 flex-shrink-0">{label}</span>
                  <span className="text-xs text-gray-700">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
