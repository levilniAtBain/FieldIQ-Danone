"use client";

import { useState, useMemo } from "react";
import { Map, List, Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { PharmacyList } from "./pharmacy-list";
import { PharmacyMap } from "./pharmacy-map";
import type { PharmacyWithMeta } from "@/lib/db/queries/pharmacies";
import { differenceInDays } from "date-fns";

type View = "list" | "map";

const TIERS = ["platinum", "gold", "silver", "bronze"] as const;

function getVisitStatus(pharmacy: PharmacyWithMeta): "green" | "amber" | "red" {
  const lastVisit = pharmacy.visits?.[0];
  if (!lastVisit?.completedAt) return "red";
  const days = differenceInDays(new Date(), new Date(lastVisit.completedAt));
  if (days <= 30) return "green";
  if (days <= 60) return "amber";
  return "red";
}

export function PharmaciesView({
  pharmacies,
}: {
  pharmacies: PharmacyWithMeta[];
}) {
  const [view, setView] = useState<View>("list");
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  const filtered = useMemo(() => {
    return pharmacies
      .map((p) => ({ ...p, visitStatus: getVisitStatus(p) }))
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Pharmacies</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pharmacies.length} accounts
          </p>
        </div>
        {/* View toggle */}
        <div className="flex rounded-xl bg-gray-100 p-1">
          <button
            onClick={() => setView("list")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all",
              view === "list"
                ? "bg-white text-gray-900 shadow-sm font-medium"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <List size={15} /> List
          </button>
          <button
            onClick={() => setView("map")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all",
              view === "map"
                ? "bg-white text-gray-900 shadow-sm font-medium"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Map size={15} /> Map
          </button>
        </div>
      </div>

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
        <div className="flex gap-1.5">
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

        {/* Visit status filter */}
        <div className="flex gap-1.5">
          {(["green", "amber", "red"] as const).map((s) => (
            <button
              key={s}
              onClick={() =>
                setStatusFilter((prev) =>
                  prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                )
              }
              className={cn(
                "w-9 h-9 rounded-xl border-2 transition-all",
                s === "green" && "bg-success-500 border-success-600",
                s === "amber" && "bg-warning-500 border-warning-600",
                s === "red" && "bg-danger-500 border-danger-600",
                statusFilter.includes(s) ? "opacity-100 scale-95" : "opacity-40"
              )}
              title={
                s === "green"
                  ? "Visited < 30d"
                  : s === "amber"
                  ? "Visited 30-60d"
                  : "Overdue > 60d"
              }
            />
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
