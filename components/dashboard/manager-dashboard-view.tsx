"use client";

import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import type { Session } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { Users, Building2, Calendar, AlertCircle, ChevronRight } from "lucide-react";

type ManagerKPIs = {
  repCount: number;
  visitsThisWeek: number;
  openActions: number;
  pharmacyCount: number;
};

type RepStat = {
  id: string;
  name: string;
  email: string;
  pharmacyCount: number;
  visitsThisWeek: number;
  openActions: number;
  lastVisitAt: Date | null;
};

export function ManagerDashboardView({
  user,
  kpis,
  teamStats,
}: {
  user: Session;
  kpis: ManagerKPIs;
  teamStats: RepStat[];
}) {
  const greeting =
    new Date().getHours() < 12
      ? "Good morning"
      : new Date().getHours() < 18
      ? "Good afternoon"
      : "Good evening";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900" suppressHydrationWarning>
          {greeting}, {user.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5" suppressHydrationWarning>
          {format(new Date(), "EEEE, MMMM d")} · Region overview
        </p>
      </div>

      {/* Region KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Field reps" value={kpis.repCount} icon={Users} color="brand" />
        <KpiCard label="Pharmacies" value={kpis.pharmacyCount} icon={Building2} color="brand" />
        <KpiCard label="Visits this week" value={kpis.visitsThisWeek} icon={Calendar} color="success" />
        <KpiCard
          label="Open actions"
          value={kpis.openActions}
          icon={AlertCircle}
          color={kpis.openActions > 10 ? "warning" : "success"}
        />
      </div>

      {/* Team roster */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Team
          </h2>
          <Link href="/team" className="text-xs text-brand-600 hover:underline font-medium">
            Full team view →
          </Link>
        </div>

        {teamStats.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
            <p className="text-sm text-gray-400">No reps in your region yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {teamStats.map((rep) => (
              <Link
                key={rep.id}
                href={`/pharmacies?rep=${rep.id}`}
                className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 p-4 hover:border-brand-200 hover:shadow-sm transition-all"
              >
                <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 font-semibold flex items-center justify-center text-sm flex-shrink-0">
                  {rep.name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{rep.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5" suppressHydrationWarning>
                    {rep.lastVisitAt
                      ? `Last visit ${formatDistanceToNow(new Date(rep.lastVisitAt), { addSuffix: true })}`
                      : "No visits yet"}
                  </p>
                </div>

                <div className="hidden sm:flex items-center gap-4 text-sm text-gray-600 flex-shrink-0">
                  <span className="text-center">
                    <p className="font-semibold text-gray-900">{rep.pharmacyCount}</p>
                    <p className="text-xs text-gray-400">pharmacies</p>
                  </span>
                  <span className="text-center">
                    <p className="font-semibold text-gray-900">{rep.visitsThisWeek}</p>
                    <p className="text-xs text-gray-400">visits/wk</p>
                  </span>
                  <span className="text-center">
                    <p className={cn("font-semibold", rep.openActions > 5 ? "text-warning-600" : "text-gray-900")}>
                      {rep.openActions}
                    </p>
                    <p className="text-xs text-gray-400">actions</p>
                  </span>
                </div>

                <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: "brand" | "success" | "warning";
}) {
  const colorMap = {
    brand: "bg-brand-50 text-brand-600",
    success: "bg-success-50 text-success-600",
    warning: "bg-warning-50 text-warning-600",
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-3", colorMap[color])}>
        <Icon size={16} />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
