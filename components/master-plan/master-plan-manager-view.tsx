"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar, Users, ChevronRight, MapPin, Stethoscope } from "lucide-react";
import { VISIT_TYPE_OPTIONS } from "@/lib/visit-types";
import { SpecialistCoordPanel, type ActionForCoord, SPECIALIST_STATUS_LABEL } from "@/components/shared/specialist-coord-panel";

type CoVisitor = { id: string; role: string; name: string; confirmed: boolean };

type Entry = {
  id: string;
  repId: string;
  plannedDate: Date | string;
  status: string;
  visitType: string | null;
  objectives: string | null;
  pharmacy: { id: string; name: string; city: string };
  coVisitors: CoVisitor[];
};

type SpecialistAction = ActionForCoord & {
  repId: string;
  pharmacy: { id: string; name: string; city: string };
};

type Rep = { id: string; name: string };

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

export function MasterPlanManagerView({
  entries,
  specialistActions,
  reps,
}: {
  entries: Entry[];
  specialistActions: SpecialistAction[];
  reps: Rep[];
}) {
  const [selectedRepId, setSelectedRepId] = useState<string>("all");
  const [localSpecialistActions, setLocalSpecialistActions] = useState(specialistActions);

  const filteredEntries = selectedRepId === "all"
    ? entries
    : entries.filter((e) => e.repId === selectedRepId);

  const filteredSpecialist = selectedRepId === "all"
    ? localSpecialistActions
    : localSpecialistActions.filter((a) => a.repId === selectedRepId);

  const upcoming = filteredEntries.filter((e) => e.status !== "completed");
  const completed = filteredEntries.filter((e) => e.status === "completed");

  // Group specialist actions by pharmacy
  const specialistByPharmacy = filteredSpecialist.reduce<
    Record<string, { pharmacy: SpecialistAction["pharmacy"]; actions: SpecialistAction[]; repName?: string }>
  >((acc, a) => {
    if (!acc[a.pharmacy.id]) {
      acc[a.pharmacy.id] = {
        pharmacy: a.pharmacy,
        actions: [],
        repName: reps.find((r) => r.id === a.repId)?.name,
      };
    }
    acc[a.pharmacy.id].actions.push(a);
    return acc;
  }, {});
  const pharmaciesWithSpecialist = Object.values(specialistByPharmacy);

  const isEmpty = entries.length === 0 && specialistActions.length === 0;

  // Total count for filter buttons
  function totalForRep(repId: string) {
    const e = entries.filter((x) => x.repId === repId).length;
    const s = localSpecialistActions.filter((x) => x.repId === repId).length;
    return e + s;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Master Plan</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Planification des visites de votre équipe
        </p>
      </div>

      {/* Rep filter */}
      {reps.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedRepId("all")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-sm font-medium transition-colors",
              selectedRepId === "all"
                ? "bg-brand-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
            )}
          >
            Toute l&apos;équipe ({entries.length + localSpecialistActions.length})
          </button>
          {reps.map((rep) => (
            <button
              key={rep.id}
              onClick={() => setSelectedRepId(rep.id)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-sm font-medium transition-colors",
                selectedRepId === rep.id
                  ? "bg-brand-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
              )}
            >
              {rep.name} ({totalForRep(rep.id)})
            </button>
          ))}
        </div>
      )}

      {isEmpty ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <Calendar size={28} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm font-medium">Aucune visite planifiée</p>
          <p className="text-gray-400 text-xs mt-1">
            Les visites planifiées par votre équipe apparaîtront ici
          </p>
        </div>
      ) : (
        <>
          {/* Specialist visits section */}
          {pharmaciesWithSpecialist.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Stethoscope size={12} /> Visites Spécialiste
              </h2>
              <div className="space-y-3">
                {pharmaciesWithSpecialist.map(({ pharmacy, actions: pharmActions, repName }) => (
                  <div key={pharmacy.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{pharmacy.name}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <MapPin size={10} /> {pharmacy.city}
                          {repName && <span className="ml-1">· {repName}</span>}
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              "text-xs font-medium px-2 py-0.5 rounded-full",
                              SPECIALIST_STATUS_LABEL[a.specialistStatus ?? "pending"]?.color ?? "bg-gray-100 text-gray-500"
                            )}>
                              {SPECIALIST_STATUS_LABEL[a.specialistStatus ?? "pending"]?.label}
                            </span>
                            {a.specialist && (
                              <span className="text-xs text-gray-600 font-medium">{a.specialist.name}</span>
                            )}
                            {a.scheduledVisitDate && (
                              <span className="text-xs text-gray-400" suppressHydrationWarning>
                                {format(new Date(a.scheduledVisitDate), "d MMM yyyy · HH:mm")}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{a.title}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Planned visits sections */}
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Visites planifiées — À venir / En cours
              </h2>
              <div className="space-y-2">
                {upcoming.map((e) => (
                  <PlanCard key={e.id} entry={e} repName={reps.find((r) => r.id === e.repId)?.name} />
                ))}
              </div>
            </section>
          )}

          {completed.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Réalisées
              </h2>
              <div className="space-y-2">
                {completed.map((e) => (
                  <PlanCard key={e.id} entry={e} repName={reps.find((r) => r.id === e.repId)?.name} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function PlanCard({ entry, repName }: { entry: Entry; repName?: string }) {
  const mvVisitor = entry.coVisitors.find((c) => c.role === "mv");
  const merchandiser = entry.coVisitors.find((c) => c.role === "merchandiser");
  const vt = VISIT_TYPE_OPTIONS.find((o) => o.value === entry.visitType) ?? VISIT_TYPE_OPTIONS[0];

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
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", STATUS_COLOR[entry.status] ?? STATUS_COLOR.draft)}>
            {STATUS_LABEL[entry.status] ?? entry.status}
          </span>
          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", vt.color)}>
            {vt.icon} {vt.label}
          </span>
          {repName && (
            <span className="text-xs text-gray-400 font-medium">— {repName}</span>
          )}
        </div>
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
