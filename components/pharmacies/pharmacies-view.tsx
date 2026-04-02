"use client";

import { useState, useMemo } from "react";
import { Map, List, Search, Info, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PharmacyList } from "./pharmacy-list";
import { PharmacyMap } from "./pharmacy-map";
import type { PharmacyWithMeta } from "@/lib/db/queries/pharmacies";

type View = "list" | "map";
type VisitStatus = "green" | "amber" | "red";
type PharmacyWithStatus = PharmacyWithMeta & { visitStatus: VisitStatus };

const TIERS = ["platinum", "gold", "silver", "bronze"] as const;

const TIER_DEFINITIONS = [
  {
    tier: "platinum",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    dot: "bg-purple-400",
    label: "Platinum",
    description: "Top 5% — highest volume, flagship accounts",
  },
  {
    tier: "gold",
    color: "bg-yellow-50 text-yellow-700 border-yellow-200",
    dot: "bg-yellow-400",
    label: "Gold",
    description: "High volume, strong L'Oréal presence",
  },
  {
    tier: "silver",
    color: "bg-gray-100 text-gray-600 border-gray-200",
    dot: "bg-gray-400",
    label: "Silver",
    description: "Medium volume, growth potential",
  },
  {
    tier: "bronze",
    color: "bg-orange-50 text-orange-700 border-orange-200",
    dot: "bg-orange-300",
    label: "Bronze",
    description: "Lower volume, emerging or occasional accounts",
  },
];

const VISIT_STATUS_DEFINITIONS = [
  {
    status: "green" as const,
    bg: "bg-success-500",
    label: "On track",
    description: "Last visit < 30 days ago",
  },
  {
    status: "amber" as const,
    bg: "bg-warning-500",
    label: "Due soon",
    description: "Last visit 30–60 days ago",
  },
  {
    status: "red" as const,
    bg: "bg-danger-500",
    label: "Overdue",
    description: "Last visit > 60 days ago or never visited",
  },
];

export function PharmaciesView({
  pharmacies,
  filterRepName,
}: {
  pharmacies: PharmacyWithStatus[];
  filterRepName?: string;
}) {
  const [view, setView] = useState<View>("list");
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [showLegend, setShowLegend] = useState(false);

  const filtered = useMemo(() => {
    return pharmacies
      .filter((p) => {
        if (search) {
          const q = search.toLowerCase();
          if (
            !p.name.toLowerCase().includes(q) &&
            !p.city.toLowerCase().includes(q)
          )
            return false;
        }
        if (tierFilter.length > 0 && !tierFilter.includes(p.tier)) return false;
        if (statusFilter.length > 0 && !statusFilter.includes(p.visitStatus))
          return false;
        return true;
      });
  }, [pharmacies, search, tierFilter, statusFilter]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Pharmacies</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pharmacies.length} account{pharmacies.length !== 1 ? "s" : ""}
            {filterRepName && (
              <span className="ml-1">· {filterRepName}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Legend toggle */}
          <button
            onClick={() => setShowLegend((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm transition-all",
              showLegend
                ? "bg-brand-50 border-brand-200 text-brand-700"
                : "bg-white border-gray-200 text-gray-500"
            )}
          >
            <Info size={14} />
            <span className="hidden sm:inline">Legend</span>
          </button>
          {/* View toggle */}
          <div className="flex rounded-xl bg-gray-100 p-1">
            <button
              onClick={() => setView("list")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all",
                view === "list"
                  ? "bg-white text-gray-900 shadow-sm font-medium"
                  : "text-gray-500"
              )}
            >
              <List size={15} />
              <span className="hidden sm:inline ml-1">List</span>
            </button>
            <button
              onClick={() => setView("map")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all",
                view === "map"
                  ? "bg-white text-gray-900 shadow-sm font-medium"
                  : "text-gray-500"
              )}
            >
              <Map size={15} />
              <span className="hidden sm:inline ml-1">Map</span>
            </button>
          </div>
        </div>
      </div>

      {/* Rep filter banner */}
      {filterRepName && (
        <div className="flex items-center justify-between bg-brand-50 border border-brand-100 rounded-xl px-4 py-2.5 text-sm">
          <span className="text-brand-800">
            Showing pharmacies for <strong>{filterRepName}</strong>
          </span>
          <Link
            href="/pharmacies"
            className="flex items-center gap-1 text-brand-600 hover:text-brand-800 font-medium"
          >
            <X size={14} /> Clear filter
          </Link>
        </div>
      )}

      {/* Legend panel */}
      {showLegend && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 grid sm:grid-cols-2 gap-5">
          {/* Visit status */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Visit status (dot colour)
            </p>
            <div className="space-y-2">
              {VISIT_STATUS_DEFINITIONS.map((d) => (
                <div key={d.status} className="flex items-start gap-3">
                  <span
                    className={cn(
                      "w-3 h-3 rounded-full flex-shrink-0 mt-0.5",
                      d.bg
                    )}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {d.label}
                    </p>
                    <p className="text-xs text-gray-500">{d.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tiers */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Account tiers (badge)
            </p>
            <div className="space-y-2">
              {TIER_DEFINITIONS.map((d) => (
                <div key={d.tier} className="flex items-start gap-3">
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0",
                      d.color
                    )}
                  >
                    {d.label}
                  </span>
                  <p className="text-xs text-gray-500 leading-5">
                    {d.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search + filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pharmacies…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>

        {/* Tier filter chips */}
        <div className="flex gap-1.5 flex-wrap">
          {TIERS.map((tier) => (
            <button
              key={tier}
              onClick={() =>
                setTierFilter((prev) =>
                  prev.includes(tier)
                    ? prev.filter((t) => t !== tier)
                    : [...prev, tier]
                )
              }
              className={cn(
                "px-3 py-2 rounded-xl text-xs font-medium border transition-all capitalize",
                tierFilter.includes(tier)
                  ? "bg-brand-50 border-brand-300 text-brand-700"
                  : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
              )}
            >
              {tier}
            </button>
          ))}
        </div>

        {/* Visit status filter with labels */}
        <div className="flex gap-1.5">
          {VISIT_STATUS_DEFINITIONS.map((s) => (
            <button
              key={s.status}
              onClick={() =>
                setStatusFilter((prev) =>
                  prev.includes(s.status)
                    ? prev.filter((x) => x !== s.status)
                    : [...prev, s.status]
                )
              }
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all",
                statusFilter.includes(s.status)
                  ? "opacity-100 border-gray-300 bg-gray-50"
                  : "opacity-50 border-gray-200 bg-white hover:opacity-75"
              )}
              title={s.description}
            >
              <span className={cn("w-2.5 h-2.5 rounded-full", s.bg)} />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      {filtered.length !== pharmacies.length && (
        <p className="text-sm text-gray-400">
          Showing {filtered.length} of {pharmacies.length}
        </p>
      )}

      {/* Content */}
      {view === "list" ? (
        <PharmacyList pharmacies={filtered} />
      ) : (
        <PharmacyMap pharmacies={filtered} />
      )}
    </div>
  );
}
