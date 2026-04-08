"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Calendar, MapPin, CheckCircle, Circle,
  Plus, X, Save, Loader2, Trash2, UserCheck, Zap, RefreshCw,
} from "lucide-react";
import { SpecialistCoordPanel, type ActionForCoord } from "@/components/shared/specialist-coord-panel";
import { getVisitTypeOption } from "@/lib/visit-types";

type PharmacyAction = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  accepted: boolean | null;
  dueAt: Date | string | null;
  assignedSpecialistId: string | null;
  scheduledVisitDate: Date | string | null;
  specialistStatus: "pending" | "contacted" | "confirmed" | null;
  specialistNotes: string | null;
  specialist: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    territory: string | null;
    notes: string | null;
  } | null;
};

type CoVisitor = {
  id: string;
  role: "mv" | "merchandiser";
  name: string;
  confirmed: boolean;
  notes: string | null;
};

type Entry = {
  id: string;
  plannedDate: Date | string;
  status: "draft" | "confirmed" | "completed";
  visitType: string | null;
  objectives: string | null;
  keyAttentionPoints: string | null;
  repTakeaways: string | null;
  mvTakeaways: string | null;
  merchandiserTakeaways: string | null;
  pharmacy: { id: string; name: string; city: string; tier: string };
  coVisitors: CoVisitor[];
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
const ROLE_LABEL: Record<string, string> = {
  mv: "Visiteur Médical (MV)",
  merchandiser: "Merchandiser",
};

type Section = "planning" | "coordination" | "exchange";

export function MasterPlanDetailView({ entry: initialEntry, readOnly = false }: { entry: Entry; readOnly?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromPharmacy = searchParams.get("from") === "pharmacy";
  const [entry, setEntry] = useState(initialEntry);
  const [activeSection, setActiveSection] = useState<Section>("planning");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const patch = useCallback(async (body: object) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/master-plan/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
    } finally {
      setSaving(false);
    }
  }, [entry.id]);

  async function handleDelete() {
    if (!confirm("Supprimer ce plan ?")) return;
    setDeleting(true);
    await fetch(`/api/master-plan/${entry.id}`, { method: "DELETE" });
    router.push(fromPharmacy ? `/pharmacies/${entry.pharmacy.id}?tab=master-plan` : "/master-plan");
  }

  async function setStatus(status: Entry["status"]) {
    await patch({ status });
    setEntry((e) => ({ ...e, status }));
  }

  return (
    <div className="space-y-5">
      {/* Back */}
      <Link
        href={fromPharmacy ? `/pharmacies/${entry.pharmacy.id}?tab=master-plan` : "/master-plan"}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={15} /> {fromPharmacy ? entry.pharmacy.name : "Master Plan"}
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", STATUS_COLOR[entry.status])}>
                {STATUS_LABEL[entry.status]}
              </span>
              {(() => { const vt = getVisitTypeOption(entry.visitType); return (
                <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", vt.color)}>
                  {vt.icon} {vt.label}
                </span>
              ); })()}
              {saving && <Loader2 size={12} className="animate-spin text-gray-400" />}
            </div>
            <h1 className="text-xl font-semibold text-gray-900">{entry.pharmacy.name}</h1>
            <p className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
              <MapPin size={13} /> {entry.pharmacy.city}
            </p>
            <p className="flex items-center gap-1.5 text-sm text-gray-600 mt-1" suppressHydrationWarning>
              <Calendar size={13} className="text-brand-500" />
              {format(new Date(entry.plannedDate), "EEEE d MMMM yyyy · HH:mm", { locale: fr })}
            </p>
          </div>
          {!readOnly && (
            <div className="flex gap-2 flex-shrink-0 flex-col sm:flex-row">
              {entry.status !== "completed" && (
                <button
                  onClick={() => setStatus(entry.status === "draft" ? "confirmed" : "completed")}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors"
                >
                  <CheckCircle size={13} />
                  {entry.status === "draft" ? "Confirmer" : "Marquer réalisé"}
                </button>
              )}
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-danger-200 text-danger-600 hover:bg-danger-50 transition-colors"
              >
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Supprimer
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl">
        {(["planning", "coordination", "exchange"] as Section[]).map((s) => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            className={cn(
              "flex-1 py-2 text-xs sm:text-sm rounded-xl transition-all",
              activeSection === s
                ? "bg-white text-gray-900 font-medium shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {s === "planning" ? "📋 Planning" : s === "coordination" ? "👥 Coordination" : "💬 Échanges"}
          </button>
        ))}
      </div>

      {/* Sections */}
      {activeSection === "planning" && (
        <PlanningSection entry={entry} pharmacyId={entry.pharmacy.id} readOnly={readOnly} onUpdate={(fields) => {
          setEntry((e) => ({ ...e, ...fields }));
          patch(fields);
        }} />
      )}
      {activeSection === "coordination" && (
        <CoordinationSection entry={entry} readOnly={readOnly} onUpdate={async (action) => {
          const res = await fetch(`/api/master-plan/${entry.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(action),
          });
          if (!res.ok) return;
          // Refresh entry
          const detail = await fetch(`/api/master-plan/${entry.id}`).then((r) => r.json());
          if (detail.entry) setEntry(detail.entry);
        }} />
      )}
      {activeSection === "exchange" && (
        <ExchangeSection entry={entry} readOnly={readOnly} onUpdate={(fields) => {
          setEntry((e) => ({ ...e, ...fields }));
          patch(fields);
        }} />
      )}
    </div>
  );
}

// ─── Planning section ─────────────────────────────────────────────────────────

const ACTION_BADGE: Record<string, string> = {
  promo: "bg-green-50 text-green-700",
  bundle: "bg-blue-50 text-blue-700",
  animation: "bg-purple-50 text-purple-700",
  specialist_visit: "bg-red-50 text-red-700",
  product_intro: "bg-brand-50 text-brand-700",
  training: "bg-orange-50 text-orange-700",
};

function PlanningSection({
  entry,
  pharmacyId,
  readOnly,
  onUpdate,
}: {
  entry: Entry;
  pharmacyId: string;
  readOnly: boolean;
  onUpdate: (fields: Partial<Entry>) => void;
}) {
  const [objectives, setObjectives] = useState(entry.objectives ?? "");
  const [keyPoints, setKeyPoints] = useState(entry.keyAttentionPoints ?? "");
  const [dirty, setDirty] = useState(false);
  const [actions, setActions] = useState<PharmacyAction[]>([]);
  const [actionsLoading, setActionsLoading] = useState(true);

  const loadActions = useCallback((silent = false) => {
    if (!silent) setActionsLoading(true);
    fetch(`/api/pharmacies/${pharmacyId}/actions`)
      .then((r) => r.json())
      .then((d) => {
        setActions(d.actions ?? []);
      })
      .finally(() => setActionsLoading(false));
  }, [pharmacyId]);

  useEffect(() => { loadActions(); }, [loadActions]);

  function save() {
    onUpdate({ objectives: objectives || null, keyAttentionPoints: keyPoints || null });
    setDirty(false);
  }

  const acceptedActions = actions.filter((a) => a.accepted === true);
  const pendingActions = actions.filter((a) => a.accepted === null);
  const dismissedActions = actions.filter((a) => a.accepted === false);

  return (
    <div className="space-y-4">
      {/* Pharmacy actions context — always visible so refresh is accessible */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <span>⚡</span> Actions décidées pour cette pharmacie
            </p>
            <button
              onClick={() => loadActions(true)}
              disabled={actionsLoading}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-600 transition-colors disabled:opacity-40"
              title="Actualiser"
            >
              <RefreshCw size={12} className={actionsLoading ? "animate-spin" : ""} />
              Actualiser
            </button>
          </div>
          {actionsLoading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 size={13} className="animate-spin text-gray-300" />
              <span className="text-xs text-gray-400">Chargement…</span>
            </div>
          ) : actions.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-1">
              Aucune action pour cette pharmacie. Acceptez des actions dans l&apos;onglet Actions puis actualisez.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                {acceptedActions.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Acceptées</p>
                    {acceptedActions.map((a) => (
                      <div key={a.id}>
                        <div className="flex items-start gap-2">
                          <CheckCircle size={13} className="text-success-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded-full capitalize", ACTION_BADGE[a.type] ?? "bg-gray-100 text-gray-600")}>
                                {a.type.replace(/_/g, " ")}
                              </span>
                              {a.dueAt && (
                                <span className="text-xs text-gray-400">
                                  {format(new Date(a.dueAt), "d MMM")}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-700 mt-0.5">{a.title}</p>
                            {a.description && (
                              <p className="text-xs text-gray-400 mt-0.5">{a.description}</p>
                            )}
                          </div>
                        </div>
                        {!["promo", "bundle"].includes(a.type) && (
                          <SpecialistCoordPanel
                            action={a as ActionForCoord}
                            pharmacyId={pharmacyId}
                            readOnly={readOnly}
                            onUpdate={(updated) => {
                              setActions((prev) =>
                                prev.map((x) => x.id === a.id ? { ...x, ...updated } : x)
                              );
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {pendingActions.length > 0 && (
                  <div className="space-y-1.5">
                    {acceptedActions.length > 0 && <div className="border-t border-gray-100 pt-2" />}
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">En attente de décision</p>
                    {pendingActions.map((a) => (
                      <div key={a.id} className="flex items-start gap-2 opacity-70">
                        <Zap size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded-full capitalize", ACTION_BADGE[a.type] ?? "bg-gray-100 text-gray-600")}>
                              {a.type.replace(/_/g, " ")}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mt-0.5">{a.title}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {dismissedActions.length > 0 && (
                  <div className="space-y-1.5">
                    {(acceptedActions.length > 0 || pendingActions.length > 0) && <div className="border-t border-gray-100 pt-2" />}
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Refusées</p>
                    {dismissedActions.map((a) => (
                      <div key={a.id} className="flex items-start gap-2 opacity-40">
                        <X size={13} className="text-gray-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-gray-500 line-through">{a.title}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Link
                href={`/pharmacies/${pharmacyId}?tab=actions`}
                className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 mt-3"
              >
                Gérer les actions <span aria-hidden>→</span>
              </Link>
            </>
          )}
        </div>

      <SectionCard title="Objectifs de la visite" icon="🎯">
        {readOnly ? (
          <p className="text-sm text-gray-700 whitespace-pre-line">{objectives || <span className="italic text-gray-400">Non renseigné</span>}</p>
        ) : (
          <textarea
            value={objectives}
            onChange={(e) => { setObjectives(e.target.value); setDirty(true); }}
            placeholder="Quels sont les objectifs de cette visite ? (ex: présenter nouveau produit, auditer le rayon, vérifier la mise en place promo…)"
            className="w-full text-sm text-gray-700 resize-none outline-none leading-relaxed min-h-24 placeholder:text-gray-300"
            rows={4}
          />
        )}
      </SectionCard>

      <SectionCard title="Points clés d'attention" icon="⚠️">
        {readOnly ? (
          <p className="text-sm text-gray-700 whitespace-pre-line">{keyPoints || <span className="italic text-gray-400">Non renseigné</span>}</p>
        ) : (
          <textarea
            value={keyPoints}
            onChange={(e) => { setKeyPoints(e.target.value); setDirty(true); }}
            placeholder="Quels sont les points d'attention particuliers ? (ex: concurrent à surveiller, rupture de stock connue, relation pharmacien délicate…)"
            className="w-full text-sm text-gray-700 resize-none outline-none leading-relaxed min-h-24 placeholder:text-gray-300"
            rows={4}
          />
        )}
      </SectionCard>

      {!readOnly && dirty && (
        <button
          onClick={save}
          className="flex items-center gap-2 bg-brand-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-brand-700"
        >
          <Save size={14} /> Sauvegarder
        </button>
      )}
    </div>
  );
}

// ─── Coordination section ─────────────────────────────────────────────────────

function CoordinationSection({
  entry,
  readOnly,
  onUpdate,
}: {
  entry: Entry;
  readOnly: boolean;
  onUpdate: (action: object) => Promise<void>;
}) {
  const [adding, setAdding] = useState<"mv" | "merchandiser" | null>(null);
  const [newName, setNewName] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const mvVisitor = entry.coVisitors.find((c) => c.role === "mv");
  const merchandiser = entry.coVisitors.find((c) => c.role === "merchandiser");

  async function addCoVisitor(role: "mv" | "merchandiser") {
    if (!newName.trim()) return;
    setSaving(true);
    await onUpdate({ addCoVisitor: { role, name: newName.trim(), notes: newNotes.trim() || undefined } });
    setAdding(null);
    setNewName("");
    setNewNotes("");
    setSaving(false);
  }

  async function removeCoVisitor(id: string) {
    await onUpdate({ removeCoVisitorId: id });
  }

  async function toggleConfirmed(cv: CoVisitor) {
    await onUpdate({ updateCoVisitor: { id: cv.id, confirmed: !cv.confirmed } });
  }

  function CoVisitorCard({ cv, roleLabel, role }: { cv: CoVisitor | undefined; roleLabel: string; role: "mv" | "merchandiser" }) {
    if (!cv) {
      return (
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-gray-400">{roleLabel} — non assigné</span>
          {!readOnly && (
            <button
              onClick={() => { setAdding(role); setNewName(""); setNewNotes(""); }}
              className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium"
            >
              <Plus size={12} /> Ajouter
            </button>
          )}
        </div>
      );
    }
    return (
      <div className="flex items-start gap-3">
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold",
          cv.confirmed ? "bg-success-100 text-success-700" : "bg-gray-100 text-gray-600"
        )}>
          {cv.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900">{cv.name}</p>
            <span className="text-xs text-gray-400">{roleLabel}</span>
          </div>
          {cv.notes && <p className="text-xs text-gray-500 mt-0.5">{cv.notes}</p>}
          {readOnly ? (
            <p className={cn("flex items-center gap-1 text-xs mt-1 font-medium", cv.confirmed ? "text-success-600" : "text-gray-400")}>
              {cv.confirmed ? <CheckCircle size={12} /> : <Circle size={12} />}
              {cv.confirmed ? "Présence confirmée" : "Non confirmé"}
            </p>
          ) : (
            <button
              onClick={() => toggleConfirmed(cv)}
              className={cn(
                "flex items-center gap-1 text-xs mt-1 font-medium",
                cv.confirmed ? "text-success-600" : "text-gray-400 hover:text-gray-600"
              )}
            >
              {cv.confirmed ? <CheckCircle size={12} /> : <Circle size={12} />}
              {cv.confirmed ? "Présence confirmée" : "Confirmer présence"}
            </button>
          )}
        </div>
        {!readOnly && (
          <button onClick={() => removeCoVisitor(cv.id)} className="text-gray-300 hover:text-danger-400 flex-shrink-0">
            <X size={14} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Visiteur Médical (MV)" icon="👨‍⚕️">
        <CoVisitorCard cv={mvVisitor} roleLabel="Visiteur Médical" role="mv" />
        {!readOnly && adding === "mv" && (
          <AddCoVisitorForm
            roleLabel="Visiteur Médical"
            name={newName}
            notes={newNotes}
            saving={saving}
            onNameChange={setNewName}
            onNotesChange={setNewNotes}
            onSave={() => addCoVisitor("mv")}
            onCancel={() => setAdding(null)}
          />
        )}
      </SectionCard>

      <SectionCard title="Merchandiser" icon="🏪">
        <CoVisitorCard cv={merchandiser} roleLabel="Merchandiser" role="merchandiser" />
        {!readOnly && adding === "merchandiser" && (
          <AddCoVisitorForm
            roleLabel="Merchandiser"
            name={newName}
            notes={newNotes}
            saving={saving}
            onNameChange={setNewName}
            onNotesChange={setNewNotes}
            onSave={() => addCoVisitor("merchandiser")}
            onCancel={() => setAdding(null)}
          />
        )}
      </SectionCard>

      {/* Summary */}
      {entry.coVisitors.length > 0 && (
        <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4">
          <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <UserCheck size={12} /> Récapitulatif co-visites
          </p>
          <div className="space-y-1">
            {entry.coVisitors.map((cv) => (
              <p key={cv.id} className="text-sm text-brand-900 flex items-center gap-2">
                {cv.confirmed
                  ? <CheckCircle size={13} className="text-success-600" />
                  : <Circle size={13} className="text-gray-400" />}
                {ROLE_LABEL[cv.role]}: {cv.name}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AddCoVisitorForm({
  roleLabel, name, notes, saving,
  onNameChange, onNotesChange, onSave, onCancel,
}: {
  roleLabel: string;
  name: string; notes: string; saving: boolean;
  onNameChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
      <input
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={`Nom du ${roleLabel}…`}
        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        autoFocus
      />
      <input
        type="text"
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Notes (optionnel)"
        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-brand-500"
      />
      <div className="flex gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">Annuler</button>
        <button
          onClick={onSave}
          disabled={saving || !name.trim()}
          className="flex items-center gap-1 px-3 py-1.5 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700 disabled:opacity-60"
        >
          {saving && <Loader2 size={11} className="animate-spin" />} Ajouter
        </button>
      </div>
    </div>
  );
}

// ─── Exchange section ─────────────────────────────────────────────────────────

function ExchangeSection({
  entry,
  readOnly,
  onUpdate,
}: {
  entry: Entry;
  readOnly: boolean;
  onUpdate: (fields: Partial<Entry>) => void;
}) {
  const [repTakeaways, setRepTakeaways] = useState(entry.repTakeaways ?? "");
  const [mvTakeaways, setMvTakeaways] = useState(entry.mvTakeaways ?? "");
  const [merchandiserTakeaways, setMerchandiserTakeaways] = useState(entry.merchandiserTakeaways ?? "");
  const [dirty, setDirty] = useState(false);

  const mvVisitor = entry.coVisitors.find((c) => c.role === "mv");
  const merchandiser = entry.coVisitors.find((c) => c.role === "merchandiser");

  function save() {
    onUpdate({
      repTakeaways: repTakeaways || null,
      mvTakeaways: mvTakeaways || null,
      merchandiserTakeaways: merchandiserTakeaways || null,
    });
    setDirty(false);
  }

  return (
    <div className="space-y-4">
      {/* Pre-visit: show planning content read-only */}
      {(entry.objectives || entry.keyAttentionPoints) && (
        <SectionCard title="Rappel pré-visite" icon="📋">
          {entry.objectives && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-500 mb-1">Objectifs</p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{entry.objectives}</p>
            </div>
          )}
          {entry.keyAttentionPoints && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Points d'attention</p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{entry.keyAttentionPoints}</p>
            </div>
          )}
        </SectionCard>
      )}

      {/* Post-visit takeaways */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Key takeaways post-visite</p>

        <SectionCard title="Compte-rendu du Pharma Partner" icon="👤">
          {readOnly ? (
            <p className="text-sm text-gray-700 whitespace-pre-line">{repTakeaways || <span className="italic text-gray-400">Non renseigné</span>}</p>
          ) : (
            <textarea
              value={repTakeaways}
              onChange={(e) => { setRepTakeaways(e.target.value); setDirty(true); }}
              placeholder="Votre bilan : ce que vous avez observé, ce qui a bien marché, les actions prises…"
              className="w-full text-sm text-gray-700 resize-none outline-none leading-relaxed min-h-20 placeholder:text-gray-300"
              rows={3}
            />
          )}
        </SectionCard>

        <SectionCard
          title={mvVisitor ? `Bilan MV — ${mvVisitor.name}` : "Bilan Visiteur Médical (MV)"}
          icon="👨‍⚕️"
          empty={!mvVisitor}
          emptyMsg="Aucun MV assigné pour cette visite"
        >
          {mvVisitor && (
            readOnly ? (
              <p className="text-sm text-gray-700 whitespace-pre-line">{mvTakeaways || <span className="italic text-gray-400">Non renseigné</span>}</p>
            ) : (
              <textarea
                value={mvTakeaways}
                onChange={(e) => { setMvTakeaways(e.target.value); setDirty(true); }}
                placeholder="Ce que le MV a retenu de la visite, les opportunités identifiées, les recommandations à pousser auprès du pharmacien…"
                className="w-full text-sm text-gray-700 resize-none outline-none leading-relaxed min-h-20 placeholder:text-gray-300"
                rows={3}
              />
            )
          )}
        </SectionCard>

        <SectionCard
          title={merchandiser ? `Bilan Merchandiser — ${merchandiser.name}` : "Bilan Merchandiser"}
          icon="🏪"
          empty={!merchandiser}
          emptyMsg="Aucun Merchandiser assigné pour cette visite"
        >
          {merchandiser && (
            readOnly ? (
              <p className="text-sm text-gray-700 whitespace-pre-line">{merchandiserTakeaways || <span className="italic text-gray-400">Non renseigné</span>}</p>
            ) : (
              <textarea
                value={merchandiserTakeaways}
                onChange={(e) => { setMerchandiserTakeaways(e.target.value); setDirty(true); }}
                placeholder="Observations du merchandiser : état du rayon, actions merchandising réalisées, recommandations…"
                className="w-full text-sm text-gray-700 resize-none outline-none leading-relaxed min-h-20 placeholder:text-gray-300"
                rows={3}
              />
            )
          )}
        </SectionCard>
      </div>

      {!readOnly && dirty && (
        <button
          onClick={save}
          className="flex items-center gap-2 bg-brand-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-brand-700"
        >
          <Save size={14} /> Sauvegarder
        </button>
      )}
    </div>
  );
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function SectionCard({
  title, icon, children, empty, emptyMsg,
}: {
  title: string;
  icon: string;
  children?: React.ReactNode;
  empty?: boolean;
  emptyMsg?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <span>{icon}</span> {title}
      </p>
      {empty ? (
        <p className="text-xs text-gray-400 italic">{emptyMsg}</p>
      ) : children}
    </div>
  );
}
