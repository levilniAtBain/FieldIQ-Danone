"use client";

import { useState } from "react";
import { RotateCcw, RotateCw } from "lucide-react";
import type { StoreLayoutAnalysis, StoreZone } from "@/lib/ai/claude";
import { PlanogramSvg } from "./planogram-svg";
import { cn } from "@/lib/utils";

// ─── Isometric projection ─────────────────────────────────────────────────────
const TILE_W = 5.5;
const TILE_H = 2.75;
const SVG_W  = 580;
const TOP_OFFSET = 60;

function isoX(rx: number, ry: number): number {
  return (rx - ry) * TILE_W / 2 + SVG_W / 2;
}
function isoY(rx: number, ry: number): number {
  return (rx + ry) * TILE_H / 2 + TOP_OFFSET;
}

// ─── Rotation (0-3, each step = 90° CW) ──────────────────────────────────────
function rotateCoord(px: number, py: number, r: number): [number, number] {
  switch (r & 3) {
    case 1: return [py, 100 - px];
    case 2: return [100 - px, 100 - py];
    case 3: return [100 - py, px];
    default: return [px, py];
  }
}

// ─── Zone heights (iso units) ─────────────────────────────────────────────────
const ZONE_HEIGHTS: Record<StoreZone["type"], number> = {
  shelf:    20,
  gondola:  20,
  end_cap:  20,
  display:  16,
  counter:  12,
  window:    0,
  alley:     0,
  entrance:  0,
};

// ─── PICOS colors ─────────────────────────────────────────────────────────────
const ZONE_COLORS: Record<StoreZone["picosStatus"], {
  top: string; left: string; right: string; stroke: string; dot: string
}> = {
  ideal:      { top: "#dcfce7", left: "#86efac", right: "#bbf7d0", stroke: "#16a34a", dot: "#16a34a" },
  needs_work: { top: "#fef9c3", left: "#fde68a", right: "#fef3c7", stroke: "#d97706", dot: "#f59e0b" },
  missing:    { top: "#fee2e2", left: "#fca5a5", right: "#fed7d7", stroke: "#ef4444", dot: "#ef4444" },
  neutral:    { top: "#f1f5f9", left: "#cbd5e1", right: "#e2e8f0", stroke: "#94a3b8", dot: "#94a3b8" },
};

// ─── Clamp zone to valid range ────────────────────────────────────────────────
function clamp(zone: StoreZone): StoreZone {
  const x = Math.max(0, Math.min(97, zone.x));
  const y = Math.max(0, Math.min(97, zone.y));
  const w = Math.max(2, Math.min(100 - x, zone.w));
  const h = Math.max(2, Math.min(100 - y, zone.h));
  return { ...zone, x, y, w, h };
}

type Pt = [number, number];
function pts(points: Pt[]): string {
  return points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

// ─── Isometric box renderer (rotation-aware) ──────────────────────────────────
function IsoBox({
  zone, selected, rotation,
}: { zone: StoreZone; selected: boolean; rotation: number }) {
  const { x, y, w, h } = zone;
  const colors = ZONE_COLORS[zone.picosStatus];
  const isoH = ZONE_HEIGHTS[zone.type] ?? 0;

  // Rotate all 4 floor corners then project to screen
  const worldCorners: Array<[number, number]> = [
    [x,     y    ],
    [x + w, y    ],
    [x + w, y + h],
    [x,     y + h],
  ];
  const screenFloor: Pt[] = worldCorners.map(([px, py]) => {
    const [rx, ry] = rotateCoord(px, py, rotation);
    return [isoX(rx, ry), isoY(rx, ry)];
  });
  const dY = isoH * TILE_H / 2;
  const screenRaised: Pt[] = screenFloor.map(([sx, sy]) => [sx, sy - dY]);

  // Front corner = highest screen Y (closest to viewer in isometric)
  let frontIdx = 0;
  for (let i = 1; i < 4; i++) {
    if (screenFloor[i][1] > screenFloor[frontIdx][1]) frontIdx = i;
  }
  const adjA = (frontIdx + 1) % 4;
  const adjB = (frontIdx + 3) % 4;
  // Distinguish left/right by screen X
  const rightIdx = screenFloor[adjA][0] >= screenFloor[adjB][0] ? adjA : adjB;
  const leftIdx  = rightIdx === adjA ? adjB : adjA;

  const fp  = screenFloor[frontIdx];
  const fp_r = screenRaised[frontIdx];
  const rp  = screenFloor[rightIdx];
  const rp_r = screenRaised[rightIdx];
  const lp  = screenFloor[leftIdx];
  const lp_r = screenRaised[leftIdx];

  // Label center + length
  const cx = screenRaised.reduce((s, [sx]) => s + sx, 0) / 4;
  const cy = screenRaised.reduce((s, [, sy]) => s + sy, 0) / 4;
  const topWidth = Math.abs(screenRaised[1][0] - screenRaised[3][0]);
  const maxChars = Math.max(2, Math.floor(topWidth / 8));
  const label = zone.label.length > maxChars
    ? zone.label.slice(0, maxChars - 1) + "…"
    : zone.label;

  const strokeColor = selected ? "#7c3aed" : colors.stroke;
  const sw = selected ? 2 : 1.2;

  if (isoH === 0) {
    return (
      <g>
        <polygon points={pts(screenFloor)} fill={colors.top} stroke={strokeColor} strokeWidth={sw} opacity={0.9} />
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
          fontSize="7" fontWeight="600" fill="#374151" style={{ pointerEvents: "none" }}>
          {label}
        </text>
        <circle cx={rp[0] - 4} cy={rp[1] - 2} r={4} fill={colors.dot} />
      </g>
    );
  }

  return (
    <g>
      {/* Right face */}
      <polygon points={pts([fp, rp, rp_r, fp_r])} fill={colors.right} stroke={strokeColor} strokeWidth={sw * 0.8} opacity={0.9} />
      {/* Left face */}
      <polygon points={pts([lp, fp, fp_r, lp_r])} fill={colors.left} stroke={strokeColor} strokeWidth={sw * 0.8} opacity={0.9} />
      {/* Top face */}
      <polygon points={pts(screenRaised)} fill={colors.top} stroke={strokeColor} strokeWidth={sw} opacity={selected ? 1 : 0.92} />
      {selected && (
        <polygon points={pts(screenRaised)} fill="none" stroke="#7c3aed" strokeWidth={2.5} opacity={0.7} />
      )}
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
        fontSize="7" fontWeight="600" fill="#374151" style={{ pointerEvents: "none" }}>
        {label}
      </text>
      <circle cx={rp_r[0] - 4} cy={rp_r[1] - 2} r={4} fill={colors.dot} />
    </g>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function Legend() {
  const items: Array<{ status: StoreZone["picosStatus"]; label: string }> = [
    { status: "ideal",      label: "PICOS ideal" },
    { status: "needs_work", label: "Needs work" },
    { status: "missing",    label: "Danone manquant" },
    { status: "neutral",    label: "Neutral" },
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 pt-1.5">
      {items.map(({ status, label }) => (
        <div key={status} className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-sm flex-shrink-0 border"
            style={{ backgroundColor: ZONE_COLORS[status].top, borderColor: ZONE_COLORS[status].stroke }}
          />
          <span className="text-[10px] text-gray-500">{label}</span>
        </div>
      ))}
      <span className="text-[10px] text-gray-400 ml-auto">Click a zone for details</span>
    </div>
  );
}

// ─── Zone detail panel ────────────────────────────────────────────────────────
function ZoneDetailPanel({ zone }: { zone: StoreZone }) {
  const statusLabels: Record<StoreZone["picosStatus"], string> = {
    ideal: "PICOS Idéal", needs_work: "À améliorer", missing: "Danone manquant", neutral: "Neutre",
  };
  const statusColors: Record<StoreZone["picosStatus"], string> = {
    ideal: "bg-green-100 text-green-700",
    needs_work: "bg-amber-100 text-amber-700",
    missing: "bg-red-100 text-red-700",
    neutral: "bg-gray-100 text-gray-500",
  };
  const showPlanogram = zone.type === "shelf" || zone.type === "gondola";
  const isEndCap = zone.type === "end_cap";
  const isCounter = zone.type === "counter";

  return (
    <div className="rounded-xl border border-violet-200 bg-white p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-800">{zone.label}</p>
        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", statusColors[zone.picosStatus])}>
          {statusLabels[zone.picosStatus]}
        </span>
      </div>
      {zone.currentContent && zone.currentContent !== "unknown" && (
        <p className="text-xs text-gray-500 leading-snug">{zone.currentContent}</p>
      )}
      {zone.picosPlacement && (
        <div className="flex items-start gap-2 bg-amber-50 rounded-lg px-2.5 py-2">
          <span className="text-amber-500 text-xs flex-shrink-0 mt-0.5">▸</span>
          <p className="text-xs text-amber-800 leading-snug">{zone.picosPlacement}</p>
        </div>
      )}
      {isEndCap && (
        <div className="bg-orange-50 rounded-lg px-2.5 py-2">
          <p className="text-xs font-semibold text-orange-700 mb-0.5">End-cap standard</p>
          <p className="text-xs text-orange-700 leading-snug">
            100% best-sellers Danone — aucun concurrent. Mettre en avant les SKUs héros de saison.
          </p>
        </div>
      )}
      {isCounter && (
        <div className="bg-blue-50 rounded-lg px-2.5 py-2">
          <p className="text-xs font-semibold text-blue-700 mb-0.5">Counter standard</p>
          <p className="text-xs text-blue-700 leading-snug">
            Fortimel display unit within reach of checkout. Add price tags + promo.
          </p>
        </div>
      )}
      {showPlanogram && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
            Perfect shelf reference
          </p>
          {/* Reduced size planogram */}
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-1.5 max-w-[220px]">
            <PlanogramSvg />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Floor + wall background (rotation-independent) ──────────────────────────
function FloorBackground() {
  const corners: Pt[] = [
    [isoX(0, 0),     isoY(0, 0)],
    [isoX(100, 0),   isoY(100, 0)],
    [isoX(100, 100), isoY(100, 100)],
    [isoX(0, 100),   isoY(0, 100)],
  ];
  // Wall lines (all 4 edges)
  const edges = [
    [corners[0], corners[1]],
    [corners[1], corners[3]],
    [corners[3], corners[2]],
    [corners[2], corners[0]],
  ] as Array<[Pt, Pt]>;

  // Bottom vertex = entrance (highest screen Y)
  const bottom = corners.reduce((a, b) => (b[1] > a[1] ? b : a));

  return (
    <>
      <polygon points={pts(corners)} fill="#f1f5f9" stroke="none" />
      {edges.map(([a, b], i) => (
        <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#475569" strokeWidth="1.5" />
      ))}
      <text
        x={bottom[0]} y={bottom[1] + 14}
        textAnchor="middle" fontSize="8" fontWeight="600" fill="#64748b" letterSpacing="0.06em"
      >
        ENTRANCE
      </text>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
type StoreLayoutViewProps = {
  analysis: StoreLayoutAnalysis;
  selectedZoneId: string | null;
  onZoneSelect: (id: string | null) => void;
};

export function StoreLayoutView({ analysis, selectedZoneId, onZoneSelect }: StoreLayoutViewProps) {
  const [rotation, setRotation] = useState(0);

  // Clamp + sort back-to-front using rotated center depth
  const zones = analysis.zones.map(clamp).sort((a, b) => {
    const [rax, ray] = rotateCoord(a.x + a.w / 2, a.y + a.h / 2, rotation);
    const [rbx, rby] = rotateCoord(b.x + b.w / 2, b.y + b.h / 2, rotation);
    return (rax + ray) - (rbx + rby);
  });

  const selectedZone = selectedZoneId
    ? analysis.zones.find(z => z.id === selectedZoneId)
    : null;

  const rotationLabel = ["Front-left", "Front-right", "Back-right", "Back-left"][rotation];

  return (
    <div className="space-y-2">
      {/* Rotation controls */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400 font-medium">View: {rotationLabel}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setRotation(r => (r + 3) % 4)}
            className="p-1 rounded hover:bg-violet-100 text-gray-400 hover:text-violet-600 transition-colors"
            title="Rotate left"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setRotation(r => (r + 1) % 4)}
            className="p-1 rounded hover:bg-violet-100 text-gray-400 hover:text-violet-600 transition-colors"
            title="Rotate right"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Isometric SVG */}
      <div
        className="rounded-xl border border-violet-100 overflow-hidden bg-slate-50 cursor-default"
        onClick={() => onZoneSelect(null)}
      >
        <svg
          viewBox={`0 0 ${SVG_W} 380`}
          xmlns="http://www.w3.org/2000/svg"
          className="w-full"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          <FloorBackground />
          {zones.map((zone) => (
            <g
              key={zone.id}
              style={{ cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                onZoneSelect(zone.id === selectedZoneId ? null : zone.id);
              }}
            >
              <IsoBox zone={zone} selected={zone.id === selectedZoneId} rotation={rotation} />
            </g>
          ))}
        </svg>
      </div>

      {/* Legend */}
      <Legend />

      {/* Zone detail panel */}
      {selectedZone && (
        <div className="mt-1">
          <ZoneDetailPanel zone={selectedZone} />
        </div>
      )}
    </div>
  );
}
