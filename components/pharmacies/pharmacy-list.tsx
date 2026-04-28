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
  accountType: string;
  pharmacistName: string | null;
  visits: { completedAt: Date | null }[];
  visitStatus: "green" | "amber" | "red";
  rep?: { name: string } | null;
};

export function PharmacyCrossIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      {/* Green cross */}
      <rect x="7" y="0" width="10" height="24" rx="2" fill="#16a34a" />
      <rect x="0" y="7" width="24" height="10" rx="2" fill="#16a34a" />
      {/* Bowl of Hygieia — white */}
      {/* Staff */}
      <line x1="12" y1="7.5" x2="12" y2="17" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
      {/* Snake S-curve */}
      <path
        d="M12 9 Q14.5 9.8 14.5 11.2 Q14.5 12.6 12 12.6 Q9.5 12.6 9.5 14 Q9.5 15.4 12 15.4"
        fill="none" stroke="white" strokeWidth="1.1" strokeLinecap="round"
      />
      {/* Snake head */}
      <circle cx="12" cy="8.6" r="0.8" fill="white" />
      {/* Bowl */}
      <path d="M10 15.5 Q12 17.2 14 15.5" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="10" y1="15.5" x2="14" y2="15.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

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
              {/* Account type icon */}
              {p.accountType === "hospital" ? (
                <span className="flex-shrink-0 w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white text-xs font-bold leading-none">
                  H
                </span>
              ) : (
                <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                  <PharmacyCrossIcon />
                </span>
              )}
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

