"use client";

import { useState } from "react";
import { X, LayoutTemplate } from "lucide-react";

function PlanogramSvg() {
  const lorealX = [14, 39, 64, 89, 114, 139];
  const compX = [166, 191, 216, 238];

  const rows: Array<{ y: number; h: number; compH: number; compY: number }> = [
    { y: 51, h: 43, compY: 54, compH: 38 },
    { y: 102, h: 40, compY: 105, compH: 35 },
    { y: 150, h: 40, compY: 153, compH: 35 },
    { y: 198, h: 44, compY: 200, compH: 42 },
  ];

  return (
    <svg
      viewBox="0 0 400 355"
      xmlns="http://www.w3.org/2000/svg"
      style={{ fontFamily: "system-ui, sans-serif" }}
      className="w-full"
    >
      {/* Background */}
      <rect width="400" height="355" fill="#fafafa" rx="8" />

      {/* Section titles */}
      <text x="138" y="40" textAnchor="middle" fontSize="9" fontWeight="700" fill="#9ca3af" letterSpacing="0.05em">
        MAIN SHELF
      </text>
      <text x="351" y="40" textAnchor="middle" fontSize="9" fontWeight="700" fill="#9ca3af" letterSpacing="0.05em">
        TN BREAKOUT
      </text>

      {/* ── Eye level highlight (rows 2-3) ── */}
      <rect x="12" y="98" width="252" height="96" fill="#fef3c7" />
      <rect x="318" y="98" width="66" height="96" fill="#fef3c7" />

      {/* ── Main shelf frame ── */}
      <rect x="12" y="48" width="252" height="198" fill="none" stroke="#d1d5db" strokeWidth="2" rx="2" />

      {/* Shelf boards */}
      <rect x="12" y="98"  width="252" height="4" fill="#9ca3af" />
      <rect x="12" y="146" width="252" height="4" fill="#9ca3af" />
      <rect x="12" y="194" width="252" height="4" fill="#9ca3af" />

      {/* 60% divider */}
      <line x1="163" y1="48" x2="163" y2="246" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.6" />

      {/* ── Products ── */}
      {rows.map((row, ri) =>
        lorealX.map((x, ci) => (
          <rect key={`l${ri}-${ci}`} x={x} y={row.y} width={23} height={row.h} fill="#f59e0b" rx="2" />
        ))
      )}
      {rows.map((row, ri) =>
        compX.map((x, ci) => (
          <rect key={`c${ri}-${ci}`} x={x} y={row.compY} width={23} height={row.compH} fill="#cbd5e1" rx="2" opacity="0.85" />
        ))
      )}

      {/* ── 60% bracket ── */}
      <line x1="12"  y1="254" x2="163" y2="254" stroke="#d97706" strokeWidth="1.5" />
      <line x1="12"  y1="249" x2="12"  y2="259" stroke="#d97706" strokeWidth="1.5" />
      <line x1="163" y1="249" x2="163" y2="259" stroke="#d97706" strokeWidth="1.5" />
      <text x="88"  y="271" textAnchor="middle" fontSize="9" fontWeight="700" fill="#b45309">60% Share of Shelf</text>

      {/* ── 40% bracket ── */}
      <line x1="163" y1="254" x2="264" y2="254" stroke="#94a3b8" strokeWidth="1.5" />
      <line x1="264" y1="249" x2="264" y2="259" stroke="#94a3b8" strokeWidth="1.5" />
      <text x="214" y="271" textAnchor="middle" fontSize="9" fill="#64748b">40% Competitor</text>

      {/* ── Eye level bracket (right) ── */}
      <line x1="272" y1="98"  x2="279" y2="98"  stroke="#d97706" strokeWidth="1.5" />
      <line x1="272" y1="194" x2="279" y2="194" stroke="#d97706" strokeWidth="1.5" />
      <line x1="279" y1="98"  x2="279" y2="194" stroke="#d97706" strokeWidth="1.5" />
      <text x="285" y="136" fontSize="8.5" fontWeight="700" fill="#b45309">Eye</text>
      <text x="285" y="147" fontSize="8.5" fontWeight="700" fill="#b45309">Level</text>
      <text x="285" y="158" fontSize="8.5" fontWeight="700" fill="#b45309">Zone</text>
      <text x="285" y="170" fontSize="8"   fill="#92400e">1.2–1.5m</text>

      {/* ── Horizontal brand blocking arrow ── */}
      <text x="138" y="291" textAnchor="middle" fontSize="9" fill="#374151">
        ← Horizontal brand blocking →
      </text>

      {/* ── TN display (end-cap, all L'Oréal) ── */}
      <rect x="318" y="48"  width="66" height="198" fill="none" stroke="#d1d5db" strokeWidth="2" rx="2" />
      <rect x="318" y="98"  width="66" height="4"   fill="#9ca3af" />
      <rect x="318" y="146" width="66" height="4"   fill="#9ca3af" />
      <rect x="318" y="194" width="66" height="4"   fill="#9ca3af" />

      {rows.map((row, ri) => (
        [320, 350].map((x, ci) => (
          <rect key={`tn${ri}-${ci}`} x={x} y={row.y} width={26} height={row.h} fill="#f59e0b" rx="2" />
        ))
      ))}

      <text x="351" y="257" textAnchor="middle" fontSize="8"   fontWeight="700" fill="#b45309">100% L'Oréal</text>
      <text x="351" y="268" textAnchor="middle" fontSize="7.5" fill="#92400e">top sellers only</text>

      {/* ── Legend ── */}
      <rect x="12"  y="304" width="11" height="11" fill="#f59e0b"  rx="2" />
      <text x="27"  y="314" fontSize="8.5" fill="#374151">L'Oréal brand</text>

      <rect x="110" y="304" width="11" height="11" fill="#cbd5e1"  rx="2" opacity="0.85" />
      <text x="125" y="314" fontSize="8.5" fill="#374151">Competitor</text>

      <rect x="200" y="304" width="11" height="11" fill="#fef3c7" rx="2" stroke="#d97706" strokeWidth="1" />
      <text x="215" y="314" fontSize="8.5" fill="#374151">Eye level zone</text>

      <line x1="308" y1="309" x2="322" y2="309" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4,3" />
      <text x="327" y="314" fontSize="8.5" fill="#374151">60% boundary</text>

      {/* ── Notes ── */}
      <text x="12" y="334" fontSize="8" fill="#6b7280">
        ✦ Face-out (FO): all products face forward — labels visible, maximum facings on priority SKUs
      </text>
      <text x="12" y="347" fontSize="8" fill="#6b7280">
        ✦ Brand / Solar / Deodorant shelf: L'Oréal section must be ≥ competitor size
      </text>
    </svg>
  );
}

export function PlanogramGuideButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="View perfect planogram guide"
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-700 transition-colors flex-shrink-0 ml-1"
      >
        <LayoutTemplate className="w-3 h-3" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Perfect Planogram</h3>
                <p className="text-xs text-gray-400 mt-0.5">PICOS shelf standards — visual guide</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* SVG diagram */}
            <div className="px-4 pt-3 pb-2">
              <PlanogramSvg />
            </div>

            {/* Key rules */}
            <div className="px-4 pb-4 grid grid-cols-2 gap-2">
              {[
                {
                  color: "bg-amber-50 border-amber-200",
                  title: "60% Share of Shelf",
                  body: "L'Oréal products must occupy ≥ 60% of the shelf space in the category.",
                },
                {
                  color: "bg-yellow-50 border-yellow-200",
                  title: "Eye Level = Buy Level",
                  body: "Priority SKUs at 1.2–1.5m height. Shelves 2 and 3 from top are the golden zone.",
                },
                {
                  color: "bg-blue-50 border-blue-200",
                  title: "Horizontal Blocking",
                  body: "Group all L'Oréal products in a continuous horizontal band — never split vertically.",
                },
                {
                  color: "bg-orange-50 border-orange-200",
                  title: "TN Breakout",
                  body: "End-cap display 100% dedicated to L'Oréal top sellers. No competitor products.",
                },
              ].map((rule) => (
                <div key={rule.title} className={`rounded-lg border p-2.5 ${rule.color}`}>
                  <p className="text-xs font-semibold text-gray-800 mb-0.5">{rule.title}</p>
                  <p className="text-xs text-gray-600 leading-snug">{rule.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
