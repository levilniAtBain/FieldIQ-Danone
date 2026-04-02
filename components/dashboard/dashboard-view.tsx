"use client";

import Link from "next/link";
import { format } from "date-fns";
import type { Session } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { Calendar, Package, AlertCircle, TrendingUp } from "lucide-react";

type KPIs = {
  visitsThisWeek: number;
  ordersThisMonth: number;
  openActions: number;
};

type TodayVisit = {
  id: string;
  scheduledAt: Date | null;
  status: string;
  pharmacy: { id: string; name: string; city: string; tier: string };
};

type OverduePharma = {
  id: string;
  name: string;
  city: string;
  tier: string;
};

export function DashboardView({
  user,
  todayVisits,
  overduePharma,
  kpis,
}: {
  user: Session;
  todayVisits: TodayVisit[];
  overduePharma: OverduePharma[];
  kpis: KPIs;
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
          {format(new Date(), "EEEE, MMMM d")}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard
          label="Visits this week"
          value={String(kpis.visitsThisWeek)}
          icon={Calendar}
          color="brand"
        />
        <KpiCard
          label="Orders this month"
          value={String(kpis.ordersThisMonth)}
          icon={Package}
          color="success"
        />
        <KpiCard
          label="Open actions"
          value={String(kpis.openActions)}
          icon={TrendingUp}
          color={kpis.openActions > 5 ? "warning" : "success"}
        />
      </div>

      {/* Today's visits */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Today&apos;s visits
        </h2>
        {todayVisits.length === 0 ? (
          <EmptyCard message="No visits scheduled for today" />
        ) : (
          <div className="space-y-2">
            {todayVisits.map((v) => (
              <Link
                key={v.id}
                href={`/pharmacies/${v.pharmacy.id}`}
                className="block bg-white rounded-2xl border border-gray-100 p-4 hover:border-brand-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {v.pharmacy.name}
                    </p>
                    <p className="text-sm text-gray-500">{v.pharmacy.city}</p>
                  </div>
                  <div className="text-right">
                    {v.scheduledAt && (
                      <p className="text-sm font-medium text-gray-700">
                        {format(new Date(v.scheduledAt), "HH:mm")}
                      </p>
                    )}
                    <StatusBadge status={v.status} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Overdue pharmacies */}
      {overduePharma.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={16} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Needs attention
            </h2>
          </div>
          <div className="space-y-2">
            {overduePharma.slice(0, 5).map((p) => (
              <Link
                key={p.id}
                href={`/pharmacies/${p.id}`}
                className="flex items-center justify-between bg-white rounded-2xl border border-amber-100 p-4 hover:border-amber-200 transition-all"
              >
                <div>
                  <p className="font-medium text-gray-900">{p.name}</p>
                  <p className="text-sm text-gray-500">{p.city}</p>
                </div>
                <TierBadge tier={p.tier} />
              </Link>
            ))}
          </div>
        </section>
      )}
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
  value: string;
  icon: React.ElementType;
  color: "brand" | "success" | "warning" | "danger";
}) {
  const colorMap = {
    brand: "bg-brand-50 text-brand-600",
    success: "bg-success-50 text-success-600",
    warning: "bg-warning-50 text-warning-600",
    danger: "bg-danger-50 text-danger-600",
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center mb-3",
          colorMap[color]
        )}
      >
        <Icon size={16} />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    planned: "bg-gray-100 text-gray-600",
    in_progress: "bg-blue-50 text-blue-600",
    completed: "bg-success-50 text-success-600",
    cancelled: "bg-danger-50 text-danger-600",
  };
  return (
    <span
      className={cn(
        "inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-1",
        map[status] ?? "bg-gray-100 text-gray-600"
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const map: Record<string, string> = {
    platinum: "bg-purple-50 text-purple-700",
    gold: "bg-yellow-50 text-yellow-700",
    silver: "bg-gray-100 text-gray-600",
    bronze: "bg-orange-50 text-orange-700",
  };
  return (
    <span
      className={cn(
        "text-xs font-medium px-2 py-1 rounded-full capitalize",
        map[tier] ?? "bg-gray-100 text-gray-600"
      )}
    >
      {tier}
    </span>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}
