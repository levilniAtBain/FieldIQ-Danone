"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Plus, Calendar, Users, ChevronRight, MapPin, X, Loader2, Stethoscope,
} from "lucide-react";
import { SpecialistCoordPanel, type ActionForCoord } from "@/components/shared/specialist-coord-panel";
import { VISIT_TYPE_OPTIONS } from "@/lib/visit-types";

type CoVisitor = { id: string; role: string; name: string; confirmed: boolean };

type Entry = {
  id: string;
  plannedDate: Date | string;
  status: string;
  visitType: string | null;
  objectives: string | null;
  pharmacy: { id: string; name: string; city: string };
  coVisitors: CoVisitor[];
};

type Pharmacy = { id: string; name: string; city: string };

type SpecialistAction = ActionForCoord & {
  type: string;
  accepted: boolean | null;
  pharmacy: { id: string; name: string; city: string };
};

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  confirmed: "bg-blue-50 text-blue-700",
  completed: "bg-success-50 text-success-700",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  confirmed: "Confirmé",
  completed: "Réalisé",
};

export function MasterPlanListView({
  entries,
  pharmacies,
}: {
  entries: Entry[];
  pharmacies: Pharmacy[];
}) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ pharmacyId: "", plannedDate: "", visitType: "follow_up" });
  const [specialistList, setSpecialistList] = useState<{ id: string; name: string; role: string; territory: string | null; hasVisited?: boolean }[]>([]);
  const [loadingSpecialists, setLoadingSpecialists] = useState(false);
  const [selectedSpecialistId, setSelectedSpecialistId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [specialistActions, setSpecialistActions] = useState<SpecialistAction[]>([]);
  const [specialistLoading, setSpecialistLoading] = useState(true);

  useEffect(() => {
    fetch("/api/actions?type=specialist_visit&accepted=true")
      .then((r) => r.json())
      .then((d) => setSpecialistActions(d.actions ?? []))
      .finally(() => setSpecialistLoading(false));
  }, []);

  function handleVisitTypeChange(value: string) {
    setForm((f) => ({ ...f, visitType: value }));
    setSelectedSpecialistId("");
    const opt = VISIT_TYPE_OPTIONS.find((o) => o.value === value);
    if (opt?.specialistRole) {
      setSpecialistList([]);
      setLoadingSpecialists(true);
      const url = `/api/specialists?role=${opt.specialistRole}${form.pharmacyId ? `&pharmacyId=${form.pharmacyId}` : ""}`;
      fetch(url)
        .then((r) => r.json())
        .then((d) => setSpecialistList(d.specialists ?? []))
        .finally(() => setLoadingSpecialists(false));
    } else {
      setSpecialistList([]);
    }
  }

  async function handleCreate() {
    if (!form.pharmacyId || !form.plannedDate) {
      setError("Sélectionnez une pharmacie et une date.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/master-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pharmacyId: form.pharmacyId,
          plannedDate: new Date(form.plannedDate).toISOString(),
          visitType: form.visitType,
          ...(() => {
            const opt = VISIT_TYPE_OPTIONS.find((o) => o.value === form.visitType);
            const s = opt?.specialistRole ? specialistList.find((x) => x.id === selectedSpecialistId) : null;
            return s ? { specialistName: s.name, specialistRole: opt!.specialistRole } : {};
          })(),
        }),
      });
      if (!res.ok) throw new Error();
      const { id } = await res.json();
      router.push(`/master-plan/${id}`);
    } catch {
      setError("Erreur lors de la création. Réessayez.");
      setCreating(false);
    }
  }

  // Group specialist actions by pharmacy
  const specialistByPharmacy = specialistActions.reduce<Record<string, { pharmacy: Pharmacy; actions: SpecialistAction[] }>>(
    (acc, a) => {
      if (!acc[a.pharmacy.id]) acc[a.pharmacy.id] = { pharmacy: a.pharmacy, actions: [] };
      acc[a.pharmacy.id].actions.push(a);
      return acc;
    },
    {}
  );
  const pharmaciesWithSpecialist = Object.values(specialistByPharmacy);

  // Group plan entries by status
  const upcoming = entries.filter((e) => e.status !== "completed");
  const completed = entries.filter((e) => e.status === "completed");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Master Plan</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Planification des visites &amp; coordination des spécialistes
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-brand-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-brand-700 transition-colors flex-shrink-0"
        >
          <Plus size={15} /> Planifier
        </button>
      </div>

      {/* New plan form */}
      {showNew && (
        <div className="bg-white rounded-2xl border border-brand-100 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Nouvelle visite planifiée</h2>
            <button onClick={() => setShowNew(false)}><X size={16} className="text-gray-400" /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Pharmacie</label>
              <select
                value={form.pharmacyId}
                onChange={(e) => setForm((f) => ({ ...f, pharmacyId: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Sélectionner…</option>
                {pharmacies.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — {p.city}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Date de visite</label>
              <input
                type="datetime-local"
                value={form.plannedDate}
                onChange={(e) => setForm((f) => ({ ...f, plannedDate: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">Type de visite</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {VISIT_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleVisitTypeChange(opt.value)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-sm transition-colors",
                    form.visitType === opt.value
                      ? cn(opt.color, "border-current font-medium")
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  )}
                >
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
              {VISIT_TYPE_OPTIONS.find((o) => o.value === form.visitType)?.specialistRole && (
                <div className="sm:col-span-2 mt-1">
                  {loadingSpecialists ? (
                    <div className="flex items-center gap-2 py-2">
                      <Loader2 size={13} className="animate-spin text-gray-400" />
                      <span className="text-xs text-gray-400">Chargement des spécialistes…</span>
                    </div>
                  ) : (
                    <select
                      value={selectedSpecialistId}
                      onChange={(e) => setSelectedSpecialistId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:ring-2 focus:ring-brand-500"
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
          {error && <p className="text-xs text-danger-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Annuler
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-brand-700 disabled:opacity-60"
            >
              {creating && <Loader2 size={13} className="animate-spin" />}
              Créer
            </button>
          </div>
        </div>
      )}

      {/* Specialist visits section */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Stethoscope size={12} /> Visites Spécialiste
        </h2>
        {specialistLoading ? (
          <div className="flex items-center gap-2 py-3">
            <Loader2 size={14} className="animate-spin text-gray-300" />
            <span className="text-xs text-gray-400">Chargement…</span>
          </div>
        ) : pharmaciesWithSpecialist.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-6 text-center">
            <p className="text-sm text-gray-400">Aucune visite spécialiste planifiée</p>
            <p className="text-xs text-gray-300 mt-1">Acceptez des actions de type &quot;Visite Spécialiste&quot; dans les fiches pharmacie</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pharmaciesWithSpecialist.map(({ pharmacy, actions: pharmActions }) => (
              <div key={pharmacy.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{pharmacy.name}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <MapPin size={10} /> {pharmacy.city}
                    </p>
                  </div>
                  <Link
                    href={`/pharmacies/${pharmacy.id}?tab=master-plan`}
                    className="text-xs text-brand-600 hover:text-brand-800 font-medium flex items-center gap-1"
                  >
                    Plan <ChevronRight size={12} />
                  </Link>
                </div>
                <div className="space-y-3">
                  {pharmActions.map((a) => (
                    <div key={a.id}>
                      <p className="text-xs text-gray-600 font-medium mb-1">{a.title}</p>
                      <SpecialistCoordPanel
                        action={a}
                        pharmacyId={pharmacy.id}
                        onUpdate={(updated) => {
                          setSpecialistActions((prev) =>
                            prev.map((x) => x.id === a.id ? { ...x, ...updated } : x)
                          );
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Planned visits section */}
      {entries.length === 0 && !showNew && pharmaciesWithSpecialist.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <Calendar size={28} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm font-medium">Aucune visite planifiée</p>
          <p className="text-gray-400 text-xs mt-1">
            Créez votre premier plan de visite pour coordonner votre équipe
          </p>
          <button
            onClick={() => setShowNew(true)}
            className="mt-4 inline-flex items-center gap-2 bg-brand-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-brand-700"
          >
            <Plus size={14} /> Planifier une visite
          </button>
        </div>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Visites planifiées — À venir / En cours
          </h2>
          <div className="space-y-2">
            {upcoming.map((e) => <PlanCard key={e.id} entry={e} />)}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Réalisées
          </h2>
          <div className="space-y-2">
            {completed.map((e) => <PlanCard key={e.id} entry={e} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function PlanCard({ entry }: { entry: Entry }) {
  const mvVisitor = entry.coVisitors.find((c) => c.role === "mv");
  const merchandiser = entry.coVisitors.find((c) => c.role === "merchandiser");

  return (
    <Link
      href={`/master-plan/${entry.id}`}
      className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 p-4 hover:border-brand-200 hover:shadow-sm transition-all"
    >
      {/* Date block */}
      <div className="flex-shrink-0 w-12 text-center">
        <p className="text-lg font-bold text-gray-900 leading-none" suppressHydrationWarning>
          {format(new Date(entry.plannedDate), "d")}
        </p>
        <p className="text-xs text-gray-400 uppercase" suppressHydrationWarning>
          {format(new Date(entry.plannedDate), "MMM")}
        </p>
      </div>

      <div className="flex-1 min-w-0">
        {(() => { const vt = VISIT_TYPE_OPTIONS.find((o) => o.value === entry.visitType) ?? VISIT_TYPE_OPTIONS[0]; return (
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", STATUS_COLOR[entry.status] ?? STATUS_COLOR.draft)}>
              {STATUS_LABEL[entry.status] ?? entry.status}
            </span>
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", vt.color)}>
              {vt.icon} {vt.label}
            </span>
          </div>
        ); })()}
        <p className="font-medium text-gray-900 truncate">{entry.pharmacy.name}</p>
        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
          <MapPin size={10} /> {entry.pharmacy.city}
          {entry.coVisitors.length > 0 && (
            <>
              <span className="mx-1">·</span>
              <Users size={10} />
              <span>
                {[
                  mvVisitor && `MV: ${mvVisitor.name}`,
                  merchandiser && `Merch: ${merchandiser.name}`,
                ].filter(Boolean).join(" · ")}
              </span>
            </>
          )}
        </p>
      </div>

      <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
    </Link>
  );
}
