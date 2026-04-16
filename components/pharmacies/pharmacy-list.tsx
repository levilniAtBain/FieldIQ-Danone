"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { ChevronRight, Clock } from "lucide-react";
import { SegmentBadge } from "@/components/shared/segment-badge";

type Pharmacy = {
  id: string;
  name: string;
  city: string;
  tier: string;
  pharmacistName: string | null;
  visits: { completedAt: Date | null }[];
  visitStatus: "green" | "amber" | "red";
  rep?: { name: string } | null;
};

export function PharmacyList({ pharmacies }: { pharmacies: Pharmacy[] }) {
  if (pharmacies.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
        <p className="text-gray-400 text-sm">No pharmacies match your filters</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pharmacies.map((p) => {
        const lastVisit = p.visits?.[0]?.completedAt;
        return (
          <Link
            key={p.id}
            href={`/pharmacies/${p.id}`}
            className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 p-4 hover:border-brand-200 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-3">
              {/* Status dot */}
              <div
                className={cn(
                  "w-2.5 h-2.5 rounded-full flex-shrink-0",
                  p.visitStatus === "green" && "bg-success-500",
                  p.visitStatus === "amber" && "bg-warning-500",
                  p.visitStatus === "red" && "bg-danger-500"
                )}
              />
              <div>
                <p className="font-medium text-gray-900">{p.name}</p>
                <p className="text-sm text-gray-500">
                  {p.city}
                  {p.pharmacistName && ` · ${p.pharmacistName}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <SegmentBadge tier={p.tier} />
                {p.rep && (
                  <p className="text-xs text-gray-400 mt-0.5">{p.rep.name}</p>
                )}
                {lastVisit ? (
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center justify-end gap-1" suppressHydrationWarning>
                    <Clock size={10} />
                    {formatDistanceToNow(new Date(lastVisit), { addSuffix: true })}
                  </p>
                ) : (
                  <p className="text-xs text-danger-500 mt-0.5">Never visited</p>
                )}
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

