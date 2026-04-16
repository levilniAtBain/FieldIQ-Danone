"use client";

import { useState, useEffect } from "react";
import { format, formatDistanceToNow, addBusinessDays } from "date-fns";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Session } from "@/lib/auth/session";
import { MapPin, Phone, ArrowLeft, Plus, Calendar, ExternalLink, Sparkles, CheckCircle, X, AlertTriangle, Loader2, RefreshCw, ChevronDown, ChevronUp, ShoppingCart, Zap, Truck, Package, CalendarRange, ChevronRight, Stethoscope } from "lucide-react";
import { useRouter } from "next/navigation";
import { SpecialistCoordPanel, SPECIALIST_STATUS_LABEL, type Specialist, type ActionForCoord } from "@/components/shared/specialist-coord-panel";
import { VISIT_TYPE_OPTIONS } from "@/lib/visit-types";
import { AiBriefing } from "./ai-briefing";
import { SegmentBadge } from "@/components/shared/segment-badge";
import { PharmacyAnalyticsTab } from "./pharmacy-analytics-tab";
import { PharmacySegmentation } from "./pharmacy-segmentation";

type Visit = {
  id: string;
  status: string;
  scheduledAt: Date | null;
  startedAt: Date | null;
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
  segmentPotential: string | null;
  segmentProfile: string[] | null;
  segmentShopper: string[] | null;
  rep: { name: string; email: string };
  visits: Visit[];
};

type Tab = "overview" | "visits" | "orders" | "actions" | "analytics" | "master-plan";

const TAB_LABEL: Record<Tab, string> = {
  overview: "Overview",
  visits: "Visits",
  orders: "Orders",
  actions: "Actions",
  analytics: "Analytics",
  "master-plan": "Plan",
};

export function PharmacyDetailView({
  pharmacy,
  session,
}: {
  pharmacy: Pharmacy;
  session: Session;
}) {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab | null) ?? "overview";
  const [tab, setTab] = useState<Tab>(initialTab);

  const tabs: Tab[] = session.role === "rep"
    ? ["overview", "visits", "orders", "actions", "analytics", "master-plan"]
    : ["overview", "visits", "orders", "actions", "analytics"];

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
              <SegmentBadge tier={pharmacy.tier} />
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

      {/* Segmentation */}
      <PharmacySegmentation
        pharmacyId={pharmacy.id}
        initialPotential={pharmacy.segmentPotential}
        initialProfile={pharmacy.segmentProfile}
        initialShopper={pharmacy.segmentShopper}
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-2 text-sm rounded-xl transition-all whitespace-nowrap",
              tab === t
                ? "bg-white text-gray-900 font-medium shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && <OverviewTab pharmacy={pharmacy} />}
      {tab === "visits" && <VisitsTab visits={pharmacy.visits} pharmacyId={pharmacy.id} session={session} />}
      {tab === "orders" && (
        <OrdersTab pharmacyId={pharmacy.id} pharmacyName={pharmacy.name} />
      )}
      {tab === "actions" && (
        <ActionsTab pharmacyId={pharmacy.id} session={session} />
      )}
      {tab === "analytics" && <PharmacyAnalyticsTab pharmacyId={pharmacy.id} />}
      {tab === "master-plan" && (
        <MasterPlanTab pharmacyId={pharmacy.id} pharmacyName={pharmacy.name} onNavigateToActions={() => setTab("actions")} />
      )}
    </div>
  );
}

type OrderSummary = {
  id: string;
  status: string;
  totalAmount: string | null;
  createdAt: Date | string;
  lines: { product: { name: string } }[];
};

export type OrderLine = {
  id: string;
  quantity: number;
  unitPrice: string | null;
  lineTotal: string | null;
  product: { id: string; name: string; sku: string; brand: string };
};

export type OrderRow = {
  id: string;
  status: string;
  totalAmount: string | null;
  createdAt: Date | string;
  submittedAt: Date | string | null;
  deliveredAt: Date | string | null;
  sourceType: string | null;
  lines: OrderLine[];
};

function promisedDeliveryDate(from: Date | string): string {
  return format(addBusinessDays(new Date(from), 5), "d MMM yyyy");
}

type ActionSummary = {
  id: string;
  type: string;
  title: string;
  accepted: boolean | null;
  createdAt: Date | string;
};

function OverviewTab({ pharmacy }: { pharmacy: Pharmacy }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [actions, setActions] = useState<ActionSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  async function loadHistory() {
    if (historyLoaded) { setHistoryOpen((v) => !v); return; }
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const [ordersRes, actionsRes] = await Promise.all([
        fetch(`/api/pharmacies/${pharmacy.id}/orders`),
        fetch(`/api/pharmacies/${pharmacy.id}/actions`),
      ]);
      if (ordersRes.ok) setOrders((await ordersRes.json()).orders ?? []);
      if (actionsRes.ok) setActions((await actionsRes.json()).actions ?? []);
      setHistoryLoaded(true);
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <AiBriefing pharmacyId={pharmacy.id} />

      {/* Notes */}
      {pharmacy.notes && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Notes
          </p>
          <p className="text-sm text-gray-700">{pharmacy.notes}</p>
        </div>
      )}

      {/* Collapsible history */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <button
          onClick={loadHistory}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2 text-gray-600">
            <Calendar size={14} />
            Account history
            <span className="text-xs text-gray-400 font-normal">
              {pharmacy.visits.length} visit{pharmacy.visits.length !== 1 ? "s" : ""}
            </span>
          </span>
          {historyLoading
            ? <Loader2 size={14} className="animate-spin text-gray-400" />
            : historyOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />
          }
        </button>

        {historyOpen && !historyLoading && (
          <div className="border-t border-gray-50 px-4 pb-4 pt-3 space-y-4">
            {/* Visits */}
            {pharmacy.visits.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Calendar size={11} /> Visits
                </p>
                <div className="space-y-1.5">
                  {pharmacy.visits.slice(0, 5).map((v) => (
                    <div key={v.id} className="flex items-start gap-2.5 text-sm">
                      <span className={cn(
                        "mt-1 w-2 h-2 rounded-full flex-shrink-0",
                        v.status === "completed" ? "bg-success-500" :
                        v.status === "in_progress" ? "bg-brand-500" : "bg-gray-300"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-700 capitalize">{v.status.replace("_", " ")}</p>
                        {v.notes && <p className="text-xs text-gray-400 truncate">{v.notes}</p>}
                      </div>
                      {(v.completedAt ?? v.startedAt ?? v.scheduledAt) && (
                        <span className="text-xs text-gray-400 flex-shrink-0 suppressHydrationWarning">
                          {format(new Date((v.completedAt ?? v.startedAt ?? v.scheduledAt)!), "d MMM yy")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Orders */}
            {orders.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <ShoppingCart size={11} /> Orders
                </p>
                <div className="space-y-1.5">
                  {orders.slice(0, 5).map((o) => (
                    <div key={o.id} className="flex items-center gap-2.5 text-sm">
                      <span className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0",
                        o.status === "delivered" ? "bg-success-500" :
                        o.status === "submitted" || o.status === "confirmed" ? "bg-brand-500" :
                        o.status === "cancelled" ? "bg-danger-500" : "bg-gray-300"
                      )} />
                      <p className="flex-1 text-gray-700 capitalize">{o.status}</p>
                      {o.totalAmount && (
                        <span className="text-xs font-medium text-gray-600">€{parseFloat(o.totalAmount).toFixed(2)}</span>
                      )}
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {format(new Date(o.createdAt), "d MMM yy")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {actions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Zap size={11} /> Actions
                </p>
                <div className="space-y-1.5">
                  {actions.slice(0, 5).map((a) => (
                    <div key={a.id} className="flex items-center gap-2.5 text-sm">
                      {a.accepted === true
                        ? <CheckCircle size={12} className="text-success-500 flex-shrink-0" />
                        : a.accepted === false
                        ? <X size={12} className="text-gray-300 flex-shrink-0" />
                        : <span className="w-2 h-2 rounded-full bg-warning-400 flex-shrink-0" />
                      }
                      <p className="flex-1 text-gray-700 truncate">{a.title}</p>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {format(new Date(a.createdAt), "d MMM yy")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pharmacy.visits.length === 0 && orders.length === 0 && actions.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-2">No history yet</p>
            )}
          </div>
        )}
      </div>

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
  session,
}: {
  visits: Visit[];
  pharmacyId: string;
  session: Session;
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
              {(v.completedAt ?? v.startedAt) && (
                <span className="text-xs text-gray-400">
                  {format(new Date((v.completedAt ?? v.startedAt)!), "dd MMM yyyy")}
                </span>
              )}
              {!v.completedAt && !v.startedAt && v.scheduledAt && (
                <span className="text-xs text-gray-400" suppressHydrationWarning>
                  {formatDistanceToNow(new Date(v.scheduledAt), { addSuffix: true })}
                </span>
              )}
            </div>
            {session.role === "rep" && (
              <Link
                href={`/pharmacies/${pharmacyId}/visit/${v.id}`}
                className="flex items-center gap-1 text-xs text-brand-600 font-medium hover:text-brand-800"
              >
                <ExternalLink size={12} />
                {v.status === "completed" ? "Reopen" : "Continue"}
              </Link>
            )}
          </div>
          {v.notes && (
            <p className="text-sm text-gray-700 line-clamp-2">{v.notes}</p>
          )}
          {v.aiReportDraft && !v.notes && (
            <p className="text-xs text-gray-400 italic line-clamp-2">{v.aiReportDraft}</p>
          )}
        </div>
      ))}
    </div>
  );
}


// ─── Orders tab ──────────────────────────────────────────────────────────────

function OrdersTab({ pharmacyId, pharmacyName }: { pharmacyId: string; pharmacyName: string }) {
  const [orderList, setOrderList] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/pharmacies/${pharmacyId}/orders`)
      .then((r) => r.json())
      .then((d) => setOrderList(d.orders ?? []))
      .finally(() => setLoading(false));
  }, [pharmacyId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (orderList.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
        <ShoppingCart size={24} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-400 text-sm">No orders yet for {pharmacyName}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {orderList.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}

function OrderCard({ order }: { order: OrderRow }) {
  const [open, setOpen] = useState(false);

  const statusColor: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600",
    submitted: "bg-blue-50 text-blue-700",
    confirmed: "bg-brand-50 text-brand-700",
    delivered: "bg-success-50 text-success-700",
    cancelled: "bg-danger-50 text-danger-700",
  };

  const isActive = order.status === "submitted" || order.status === "confirmed";
  const isDraft = order.status === "draft";
  const isDelivered = order.status === "delivered";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
      >
        <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full capitalize flex-shrink-0", statusColor[order.status] ?? "bg-gray-100 text-gray-600")}>
          {order.status}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 font-medium" suppressHydrationWarning>
              {format(new Date(order.createdAt), "d MMM yyyy")}
            </span>
            {order.sourceType && (
              <span className="text-xs text-gray-400 capitalize">{order.sourceType.replace(/_/g, " ")}</span>
            )}
          </div>
          {/* Delivery line */}
          <div className="flex items-center gap-1 mt-0.5">
            {isDelivered && order.deliveredAt ? (
              <p className="text-xs text-success-600 flex items-center gap-1">
                <Truck size={10} /> Delivered {format(new Date(order.deliveredAt), "d MMM yyyy")}
              </p>
            ) : isActive && order.submittedAt ? (
              <p className="text-xs text-blue-600 flex items-center gap-1">
                <Truck size={10} /> Est. delivery {promisedDeliveryDate(order.submittedAt)}
              </p>
            ) : isDraft ? (
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Package size={10} /> If submitted today: est. {promisedDeliveryDate(new Date())}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {order.totalAmount && (
            <span className="text-sm font-semibold text-gray-800">
              €{parseFloat(order.totalAmount).toFixed(2)}
            </span>
          )}
          {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </button>

      {/* Lines detail */}
      {open && (
        <div className="border-t border-gray-50 px-4 pb-4 pt-3">
          {order.lines.length === 0 ? (
            <p className="text-xs text-gray-400">No items</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left font-medium pb-1.5">Product</th>
                  <th className="text-right font-medium pb-1.5 w-10">Qty</th>
                  <th className="text-right font-medium pb-1.5 w-20">Unit</th>
                  <th className="text-right font-medium pb-1.5 w-20">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {order.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="py-1.5 pr-2">
                      <p className="text-gray-800 font-medium leading-tight">{line.product.name}</p>
                      <p className="text-gray-400 mt-0.5">{line.product.sku}</p>
                    </td>
                    <td className="text-right text-gray-700 py-1.5">{line.quantity}</td>
                    <td className="text-right text-gray-600 py-1.5">
                      {line.unitPrice ? `€${parseFloat(line.unitPrice).toFixed(2)}` : "—"}
                    </td>
                    <td className="text-right text-gray-800 font-medium py-1.5">
                      {line.lineTotal ? `€${parseFloat(line.lineTotal).toFixed(2)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              {order.totalAmount && (
                <tfoot>
                  <tr className="border-t border-gray-200">
                    <td colSpan={3} className="pt-2 text-gray-500 font-medium">Total</td>
                    <td className="pt-2 text-right text-gray-900 font-semibold">
                      €{parseFloat(order.totalAmount).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Actions tab ─────────────────────────────────────────────────────────────

type ActionRow = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  aiGenerated: boolean;
  accepted: boolean | null;
  dueAt: Date | string | null;
  createdAt: Date | string;
  // Specialist coordination
  assignedSpecialistId: string | null;
  scheduledVisitDate: Date | string | null;
  specialistStatus: "pending" | "contacted" | "confirmed" | null;
  specialistNotes: string | null;
  specialist: Specialist | null;
};

const ACTION_BADGE: Record<string, string> = {
  promo: "bg-green-50 text-green-700",
  bundle: "bg-blue-50 text-blue-700",
  animation: "bg-purple-50 text-purple-700",
  specialist_visit: "bg-danger-50 text-danger-700",
  product_intro: "bg-brand-50 text-brand-700",
  training: "bg-orange-50 text-orange-700",
};

function ActionsTab({ pharmacyId, session }: { pharmacyId: string; session: Session }) {
  const [actionList, setActionList] = useState<ActionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [specialistRecommended, setSpecialistRecommended] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localAccepted, setLocalAccepted] = useState<Record<string, boolean | null>>({});

  useEffect(() => {
    fetch(`/api/pharmacies/${pharmacyId}/actions`)
      .then((r) => r.json())
      .then((d) => {
        setActionList(d.actions ?? []);
        setSpecialistRecommended(d.specialistVisitRecommended ?? false);
      })
      .catch(() => setError("Failed to load actions"))
      .finally(() => setLoading(false));
  }, [pharmacyId]);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/pharmacies/${pharmacyId}/actions/generate`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed");
      }
      const d = await res.json();
      setActionList((prev) => [...(d.actions ?? []), ...prev]);
    } catch (e: unknown) {
      setError((e as Error).message || "Failed to generate actions");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDecision(actionId: string, accepted: boolean) {
    setLocalAccepted((prev) => ({ ...prev, [actionId]: accepted }));
    try {
      await fetch(`/api/actions/${actionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted }),
      });
    } catch {
      setLocalAccepted((prev) => ({ ...prev, [actionId]: null }));
      setError("Failed to update action. Please try again.");
    }
  }

  function getAccepted(a: ActionRow): boolean | null {
    return a.id in localAccepted ? localAccepted[a.id] : a.accepted;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const pending = actionList.filter((a) => getAccepted(a) === null);
  const accepted = actionList.filter((a) => getAccepted(a) === true);

  return (
    <div className="space-y-4">
      {/* Specialist visit banner */}
      {specialistRecommended && (
        <div className="flex items-start gap-3 bg-danger-50 border border-danger-100 rounded-2xl px-4 py-3">
          <AlertTriangle size={16} className="text-danger-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-danger-800">
            A <strong>specialist visit</strong> is recommended for this pharmacy — shelf score is low or it has been more than 60 days since the last visit.
          </p>
        </div>
      )}

      {/* Pending actions */}
      {pending.length > 0 && (
        <div className="space-y-2">
          {pending.map((a) => (
            <div key={a.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full capitalize", ACTION_BADGE[a.type] ?? "bg-gray-100 text-gray-600")}>
                      {a.type.replace(/_/g, " ")}
                    </span>
                    {a.dueAt && (
                      <span className="text-xs text-gray-400">
                        Due {format(new Date(a.dueAt), "d MMM yyyy")}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900">{a.title}</p>
                  {a.description && (
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{a.description}</p>
                  )}
                </div>
                {session.role === "rep" && (
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleDecision(a.id, true)}
                      className="flex items-center gap-1 bg-success-50 text-success-700 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-success-100 transition-colors"
                    >
                      <CheckCircle size={12} /> Accept
                    </button>
                    <button
                      onClick={() => handleDecision(a.id, false)}
                      className="flex items-center gap-1 bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <X size={12} /> Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {pending.length === 0 && accepted.length === 0 && !generating && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <Sparkles size={24} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500 mb-1">No actions yet</p>
          <p className="text-xs text-gray-400">Generate AI-powered recommendations based on this pharmacy's profile and visit history</p>
        </div>
      )}

      {/* Accepted actions (collapsed) */}
      {accepted.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Accepted</p>
          {accepted.map((a) => (
            <div key={a.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5 opacity-60">
              <CheckCircle size={14} className="text-success-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 truncate">{a.title}</p>
              </div>
              <span className={cn("text-xs px-1.5 py-0.5 rounded-full capitalize flex-shrink-0", ACTION_BADGE[a.type] ?? "bg-gray-100 text-gray-600")}>
                {a.type.replace(/_/g, " ")}
              </span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-xs text-danger-600">{error}</p>
      )}

      {/* Generate button — rep only */}
      {session.role === "rep" && (
        <button
          onClick={generate}
          disabled={generating}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium transition-colors",
            actionList.length > 0
              ? "border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              : "bg-brand-600 text-white hover:bg-brand-700",
            generating && "opacity-60 cursor-not-allowed"
          )}
        >
          {generating ? (
            <><Loader2 size={14} className="animate-spin" /> Generating actions…</>
          ) : actionList.length > 0 ? (
            <><RefreshCw size={14} /> Regenerate actions</>
          ) : (
            <><Sparkles size={14} /> Generate AI actions</>
          )}
        </button>
      )}
    </div>
  );
}

// ─── Master Plan tab ─────────────────────────────────────────────────────────

type PlanEntry = {
  id: string;
  plannedDate: Date | string;
  status: string;
  objectives: string | null;
  coVisitors: { id: string; role: string; name: string; confirmed: boolean }[];
};

const PLAN_STATUS_COLOR: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  confirmed: "bg-blue-50 text-blue-700",
  completed: "bg-success-50 text-success-700",
};
const PLAN_STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  confirmed: "Confirmé",
  completed: "Réalisé",
};

function MasterPlanTab({ pharmacyId, pharmacyName, onNavigateToActions }: { pharmacyId: string; pharmacyName: string; onNavigateToActions: () => void }) {
  const router = useRouter();
  const [entries, setEntries] = useState<PlanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [plannedDate, setPlannedDate] = useState("");
  const [visitType, setVisitType] = useState<string>("follow_up");
  const [specialistList, setSpecialistList] = useState<{ id: string; name: string; role: string; territory: string | null; hasVisited?: boolean }[]>([]);
  const [loadingSpecialists, setLoadingSpecialists] = useState(false);
  const [selectedSpecialistId, setSelectedSpecialistId] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Actions panel
  const [planActions, setPlanActions] = useState<ActionRow[]>([]);
  const [actionsLoading, setActionsLoading] = useState(true);

  function loadActions(silent = false) {
    if (!silent) setActionsLoading(true);
    fetch(`/api/pharmacies/${pharmacyId}/actions`)
      .then((r) => r.json())
      .then((d) => setPlanActions(d.actions ?? []))
      .finally(() => setActionsLoading(false));
  }

  useEffect(() => {
    fetch(`/api/pharmacies/${pharmacyId}/master-plan`)
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []))
      .finally(() => setLoading(false));
    loadActions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pharmacyId]);

  function handleVisitTypeChange(value: string) {
    setVisitType(value);
    setSelectedSpecialistId("");
    const opt = VISIT_TYPE_OPTIONS.find((o) => o.value === value);
    if (opt?.specialistRole && specialistList.length === 0) {
      setLoadingSpecialists(true);
      fetch(`/api/specialists?role=${opt.specialistRole}&pharmacyId=${pharmacyId}`)
        .then((r) => r.json())
        .then((d) => setSpecialistList(d.specialists ?? []))
        .finally(() => setLoadingSpecialists(false));
    }
  }

  async function handleCreate() {
    if (!plannedDate) { setError("Sélectionnez une date."); return; }
    setCreating(true);
    setError(null);
    try {
      const opt = VISIT_TYPE_OPTIONS.find((o) => o.value === visitType);
      const specialist = opt?.specialistRole ? specialistList.find((s) => s.id === selectedSpecialistId) : null;
      const res = await fetch("/api/master-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pharmacyId,
          plannedDate: new Date(plannedDate).toISOString(),
          visitType,
          ...(specialist ? { specialistName: specialist.name, specialistRole: opt!.specialistRole } : {}),
        }),
      });
      if (!res.ok) throw new Error();
      const { id } = await res.json();
      router.push(`/master-plan/${id}?from=pharmacy`);
    } catch {
      setError("Erreur lors de la création.");
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  // Actions that require a visit (all except promo/bundle)
  const visitActionTypes = new Set(["specialist_visit", "animation", "product_intro", "training"]);
  const visitCoordActions = planActions.filter((a) => a.accepted === true && visitActionTypes.has(a.type));
  const acceptedOtherActions = planActions.filter((a) => a.accepted === true && !visitActionTypes.has(a.type));
  const pendingPlanActions = planActions.filter((a) => a.accepted === null);
  const dismissedPlanActions = planActions.filter((a) => a.accepted === false);

  const refreshBtn = (
    <button
      onClick={() => loadActions(true)}
      disabled={actionsLoading}
      className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-600 transition-colors disabled:opacity-40"
    >
      <RefreshCw size={12} className={actionsLoading ? "animate-spin" : ""} />
      Actualiser
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Visits to coordinate — all non-promo/bundle accepted actions */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <Stethoscope size={12} /> Visites à coordonner
          </p>
          {refreshBtn}
        </div>
        {actionsLoading ? (
          <div className="flex items-center gap-2 py-1">
            <Loader2 size={13} className="animate-spin text-gray-300" />
            <span className="text-xs text-gray-400">Chargement…</span>
          </div>
        ) : visitCoordActions.length === 0 ? (
          <p className="text-xs text-gray-400 italic">
            Aucune visite à coordonner. Acceptez des actions dans l&apos;onglet{" "}
            <button onClick={onNavigateToActions} className="font-semibold text-brand-600 hover:underline">Actions</button>.
          </p>
        ) : (
          <div className="space-y-4">
            {visitCoordActions.map((a) => (
              <div key={a.id}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded-full capitalize", ACTION_BADGE[a.type] ?? "bg-gray-100 text-gray-600")}>
                    {a.type.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-800">{a.title}</p>
                {a.description && <p className="text-xs text-gray-400 mt-0.5">{a.description}</p>}
                <SpecialistCoordPanel action={a} pharmacyId={pharmacyId} onUpdate={(updated) => {
                  setPlanActions((prev) => prev.map((x) => x.id === a.id ? { ...x, ...updated } : x));
                }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Promo/bundle actions + pending */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-3">
          <Zap size={12} /> Promos &amp; bundles décidés
        </p>
        {actionsLoading ? (
          <div className="flex items-center gap-2 py-1">
            <Loader2 size={13} className="animate-spin text-gray-300" />
            <span className="text-xs text-gray-400">Chargement…</span>
          </div>
        ) : (
          <div className="space-y-2">
            {acceptedOtherActions.length === 0 && pendingPlanActions.length === 0 && dismissedPlanActions.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Aucune action promo/bundle.</p>
            ) : (
              <>
                {acceptedOtherActions.map((a) => (
                  <div key={a.id} className="flex items-center gap-2">
                    <CheckCircle size={12} className="text-success-500 flex-shrink-0" />
                    <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded-full capitalize flex-shrink-0", ACTION_BADGE[a.type] ?? "bg-gray-100 text-gray-600")}>
                      {a.type.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-gray-700 truncate flex-1">{a.title}</span>
                  </div>
                ))}
                {pendingPlanActions.length > 0 && (
                  <button
                    onClick={onNavigateToActions}
                    className="text-xs text-brand-600 hover:text-brand-800 hover:underline pt-1 block"
                  >
                    + {pendingPlanActions.length} action{pendingPlanActions.length > 1 ? "s" : ""} en attente de décision →
                  </button>
                )}
                {dismissedPlanActions.length > 0 && (
                  <div className="pt-1 border-t border-gray-100 space-y-1">
                    {dismissedPlanActions.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 opacity-40">
                        <X size={12} className="text-gray-400 flex-shrink-0" />
                        <span className="text-xs text-gray-500 line-through truncate flex-1">{a.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Visites planifiées</p>
        <button
          onClick={() => { setShowNew(true); setError(null); }}
          className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-800"
        >
          <Plus size={13} /> Planifier une co-visite
        </button>
      </div>

      {/* New plan form */}
      {showNew && (
        <div className="bg-white rounded-2xl border border-brand-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Nouvelle visite — {pharmacyName}</p>
            <button onClick={() => setShowNew(false)}><X size={15} className="text-gray-400" /></button>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">Type de visite</label>
            <div className="grid grid-cols-1 gap-1.5">
              {VISIT_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleVisitTypeChange(opt.value)}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left text-sm transition-colors",
                    visitType === opt.value
                      ? cn(opt.color, "border-current font-medium")
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  )}
                >
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
              {/* Specialist selector for MV/Merchandising types */}
              {VISIT_TYPE_OPTIONS.find((o) => o.value === visitType)?.specialistRole && (
                <div className="mt-1">
                  {loadingSpecialists ? (
                    <div className="flex items-center gap-2 py-2">
                      <Loader2 size={13} className="animate-spin text-gray-400" />
                      <span className="text-xs text-gray-400">Chargement des spécialistes…</span>
                    </div>
                  ) : (
                    <select
                      value={selectedSpecialistId}
                      onChange={(e) => setSelectedSpecialistId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="">Sélectionner un spécialiste… (optionnel)</option>
                      {specialistList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.hasVisited ? "★ " : ""}{s.name}{` · ${s.role === "mv" ? "MV" : "Merchandiser"}`}{s.territory ? ` — ${s.territory}` : ""}{s.hasVisited ? " (déjà venu)" : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Date de visite</label>
            <input
              type="datetime-local"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          {error && <p className="text-xs text-danger-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
              Annuler
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-1.5 bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-brand-700 disabled:opacity-60"
            >
              {creating && <Loader2 size={13} className="animate-spin" />}
              Créer et planifier
            </button>
          </div>
        </div>
      )}

      {/* Visit items — from all accepted visit-type actions */}
      {visitCoordActions.map((a) => {
        const specStatus = a.specialistStatus ?? "pending";
        const statusColor = {
          pending: "bg-gray-100 text-gray-500",
          contacted: "bg-amber-50 text-amber-700",
          confirmed: "bg-success-50 text-success-700",
        }[specStatus];
        const statusLabel = { pending: "À planifier", contacted: "Contacté", confirmed: "Confirmé" }[specStatus];
        return (
          <div key={a.id} className="bg-white rounded-2xl border border-red-100 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-11 text-center">
                {a.scheduledVisitDate ? (
                  <>
                    <p className="text-lg font-bold text-gray-900 leading-none" suppressHydrationWarning>
                      {format(new Date(a.scheduledVisitDate), "d")}
                    </p>
                    <p className="text-xs text-gray-400 uppercase" suppressHydrationWarning>
                      {format(new Date(a.scheduledVisitDate), "MMM")}
                    </p>
                  </>
                ) : (
                  <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-red-50">
                    <Stethoscope size={16} className="text-red-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", statusColor)}>
                    {statusLabel}
                  </span>
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-700">
                    Visite Spécialiste
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{a.title}</p>
                {a.specialist && (
                  <p className="text-xs text-gray-500 mt-0.5">{a.specialist.name}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Master plan entries */}
      {entries.length === 0 && !showNew && visitCoordActions.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <CalendarRange size={24} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500 mb-1">Aucune visite planifiée pour {pharmacyName}</p>
          <p className="text-xs text-gray-400">Créez un plan pour coordonner votre prochaine visite</p>
        </div>
      )}

      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((e) => (
            <Link
              key={e.id}
              href={`/master-plan/${e.id}?from=pharmacy`}
              className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 p-4 hover:border-brand-200 hover:shadow-sm transition-all"
            >
              <div className="flex-shrink-0 w-11 text-center">
                <p className="text-lg font-bold text-gray-900 leading-none" suppressHydrationWarning>
                  {format(new Date(e.plannedDate), "d")}
                </p>
                <p className="text-xs text-gray-400 uppercase" suppressHydrationWarning>
                  {format(new Date(e.plannedDate), "MMM")}
                </p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", PLAN_STATUS_COLOR[e.status] ?? PLAN_STATUS_COLOR.draft)}>
                    {PLAN_STATUS_LABEL[e.status] ?? e.status}
                  </span>
                  {e.coVisitors.length > 0 && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <CalendarRange size={10} />
                      {e.coVisitors.length} co-visiteur{e.coVisitors.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {e.objectives && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">{e.objectives}</p>
                )}
              </div>
              <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
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
        "text-xs font-medium px-2 py-0.5 rounded-full capitalize",
        map[status] ?? "bg-gray-100 text-gray-600"
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}
