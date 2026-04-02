"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type { Session } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { Building2, Calendar, Clock } from "lucide-react";

type RepStat = {
  id: string;
  name: string;
  email: string;
  pharmacyCount: number;
  visitsThisWeek: number;
  lastVisitAt: Date | null;
};

export function TeamView({
  session,
  reps,
}: {
  session: Session;
  reps: RepStat[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">My Team</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {reps.length} field rep{reps.length !== 1 ? "s" : ""} in your region
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-2xl font-bold text-gray-900">{reps.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Field reps</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-2xl font-bold text-gray-900">
            {reps.reduce((s, r) => s + r.pharmacyCount, 0)}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Pharmacies covered</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-2xl font-bold text-gray-900">
            {reps.reduce((s, r) => s + r.visitsThisWeek, 0)}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Visits this week</p>
        </div>
      </div>

      {/* Rep list */}
      <div className="space-y-3">
        {reps.map((rep) => (
          <div
            key={rep.id}
            className="bg-white rounded-2xl border border-gray-100 p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 font-semibold flex items-center justify-center text-sm flex-shrink-0">
                  {rep.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{rep.name}</p>
                  <p className="text-sm text-gray-500">{rep.email}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Building2 size={14} className="text-gray-400" />
                <span>
                  <span className="font-semibold text-gray-900">
                    {rep.pharmacyCount}
                  </span>{" "}
                  pharmacies
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar size={14} className="text-gray-400" />
                <span>
                  <span className="font-semibold text-gray-900">
                    {rep.visitsThisWeek}
                  </span>{" "}
                  visits this week
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock size={14} className="text-gray-400" />
                {rep.lastVisitAt ? (
                  <span>
                    Last visit{" "}
                    {formatDistanceToNow(new Date(rep.lastVisitAt), {
                      addSuffix: true,
                    })}
                  </span>
                ) : (
                  <span className="text-danger-500">No visits yet</span>
                )}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-50">
              <Link
                href={`/pharmacies?rep=${rep.id}`}
                className="text-sm text-brand-600 hover:underline font-medium"
              >
                View pharmacies →
              </Link>
            </div>
          </div>
        ))}

        {reps.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
            <p className="text-gray-400 text-sm">No reps found in your region</p>
          </div>
        )}
      </div>
    </div>
  );
}
