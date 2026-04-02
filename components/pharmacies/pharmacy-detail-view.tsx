"use client";

import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Session } from "@/lib/auth/session";
import { MapPin, Phone, ArrowLeft, Plus, Calendar } from "lucide-react";

type Visit = {
  id: string;
  status: string;
  scheduledAt: Date | null;
  completedAt: Date | null;
  notes: string | null;
  aiReportDraft: string | null;
};

type Pharmacy = {
  id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  tier: string;
  pharmacistName: string | null;
  pharmacistPhone: string | null;
  segment: string | null;
  notes: string | null;
  rep: { name: string; email: string };
  visits: Visit[];
};

type Tab = "overview" | "visits" | "orders" | "actions";

export function PharmacyDetailView({
  pharmacy,
  session,
}: {
  pharmacy: Pharmacy;
  session: Session;
}) {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="space-y-5">
      {/* Back */}
      <Link
        href="/pharmacies"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={15} /> Back to pharmacies
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TierBadge tier={pharmacy.tier} />
              {pharmacy.segment && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {pharmacy.segment}
                </span>
              )}
            </div>
            <h1 className="text-xl font-semibold text-gray-900">
              {pharmacy.name}
            </h1>
            <p className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
              <MapPin size={13} />
              {pharmacy.address}, {pharmacy.postalCode} {pharmacy.city}
            </p>
            {pharmacy.pharmacistName && (
              <p className="text-sm text-gray-500 mt-0.5">
                {pharmacy.pharmacistName}
                {pharmacy.pharmacistPhone && (
                  <span className="ml-2 inline-flex items-center gap-1 text-brand-600">
                    <Phone size={12} />
                    {pharmacy.pharmacistPhone}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Quick action — start visit */}
          {session.role === "rep" && (
            <Link
              href={`/pharmacies/${pharmacy.id}/visit/new`}
              className="flex-shrink-0 flex items-center gap-2 bg-brand-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-brand-700 transition-colors"
            >
              <Plus size={15} />
              Start visit
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl">
        {(["overview", "visits", "orders", "actions"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-2 text-sm rounded-xl transition-all capitalize",
              tab === t
                ? "bg-white text-gray-900 font-medium shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && <OverviewTab pharmacy={pharmacy} />}
      {tab === "visits" && <VisitsTab visits={pharmacy.visits} pharmacyId={pharmacy.id} />}
      {tab === "orders" && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">Orders coming in Phase 3</p>
        </div>
      )}
      {tab === "actions" && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">AI Actions coming in Phase 2</p>
        </div>
      )}
    </div>
  );
}

function OverviewTab({ pharmacy }: { pharmacy: Pharmacy }) {
  return (
    <div className="space-y-4">
      {/* AI briefing placeholder */}
      <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4">
        <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-1">
          AI Account Briefing
        </p>
        <p className="text-sm text-brand-800">
          AI briefing will appear here after Phase 2 (Claude API integration).
        </p>
      </div>

      {/* Notes */}
      {pharmacy.notes && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Notes
          </p>
          <p className="text-sm text-gray-700">{pharmacy.notes}</p>
        </div>
      )}

      {/* Rep info (for manager view) */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Assigned Rep
        </p>
        <p className="text-sm font-medium text-gray-900">{pharmacy.rep.name}</p>
        <p className="text-sm text-gray-500">{pharmacy.rep.email}</p>
      </div>
    </div>
  );
}

function VisitsTab({
  visits,
  pharmacyId,
}: {
  visits: Visit[];
  pharmacyId: string;
}) {
  if (visits.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
        <Calendar size={24} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-400 text-sm">No visits recorded yet</p>
        <Link
          href={`/pharmacies/${pharmacyId}/visit/new`}
          className="inline-flex items-center gap-1.5 mt-3 text-sm text-brand-600 font-medium hover:underline"
        >
          <Plus size={14} /> Schedule first visit
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {visits.map((v) => (
        <div
          key={v.id}
          className="bg-white rounded-2xl border border-gray-100 p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <StatusBadge status={v.status} />
              {v.completedAt && (
                <span className="text-xs text-gray-400">
                  {format(new Date(v.completedAt), "dd MMM yyyy")}
                </span>
              )}
            </div>
            {v.scheduledAt && (
              <span className="text-xs text-gray-400">
                Scheduled {formatDistanceToNow(new Date(v.scheduledAt), { addSuffix: true })}
              </span>
            )}
          </div>
          {v.notes && (
            <p className="text-sm text-gray-700 line-clamp-2">{v.notes}</p>
          )}
        </div>
      ))}
    </div>
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
        "text-xs font-medium px-2 py-0.5 rounded-full capitalize",
        map[tier] ?? "bg-gray-100 text-gray-600"
      )}
    >
      {tier}
    </span>
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
        "text-xs font-medium px-2 py-0.5 rounded-full capitalize",
        map[status] ?? "bg-gray-100 text-gray-600"
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}
