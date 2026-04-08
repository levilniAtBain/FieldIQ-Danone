"use client";

import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Loader2, Save, Mail, MessageSquare, Phone } from "lucide-react";

export type Specialist = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  territory: string | null;
  notes: string | null;
  hasVisited?: boolean;
};

export type ActionForCoord = {
  id: string;
  title: string;
  description: string | null;
  assignedSpecialistId: string | null;
  scheduledVisitDate: Date | string | null;
  specialistStatus: "pending" | "contacted" | "confirmed" | null;
  specialistNotes: string | null;
  specialist: Specialist | null;
};

export const SPECIALIST_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:   { label: "Non assigné",  color: "bg-gray-100 text-gray-500" },
  contacted: { label: "Contacté",     color: "bg-amber-50 text-amber-700" },
  confirmed: { label: "Confirmé",     color: "bg-success-50 text-success-700" },
};

export function SpecialistCoordPanel({
  action,
  pharmacyId,
  onUpdate,
}: {
  action: ActionForCoord;
  pharmacyId: string;
  onUpdate: (updated: Partial<ActionForCoord>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [loadingSpec, setLoadingSpec] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedId, setSelectedId] = useState(action.assignedSpecialistId ?? "");
  const [visitDate, setVisitDate] = useState(
    action.scheduledVisitDate
      ? format(new Date(action.scheduledVisitDate), "yyyy-MM-dd'T'HH:mm")
      : ""
  );
  const [notes, setNotes] = useState(action.specialistNotes ?? "");
  const [status, setStatus] = useState<"pending" | "contacted" | "confirmed">(
    action.specialistStatus ?? "pending"
  );

  const specialist = action.specialist ?? specialists.find((s) => s.id === selectedId) ?? null;

  const isDirty =
    selectedId !== (action.assignedSpecialistId ?? "") ||
    visitDate !== (action.scheduledVisitDate ? format(new Date(action.scheduledVisitDate), "yyyy-MM-dd'T'HH:mm") : "") ||
    notes !== (action.specialistNotes ?? "") ||
    status !== (action.specialistStatus ?? "pending");

  function openPanel() {
    setOpen(true);
    if (specialists.length === 0) {
      setLoadingSpec(true);
      fetch(`/api/specialists?pharmacyId=${pharmacyId}`)
        .then((r) => r.json())
        .then((d) => setSpecialists(d.specialists ?? []))
        .finally(() => setLoadingSpec(false));
    }
  }

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/actions/${action.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedSpecialistId: selectedId || null,
          scheduledVisitDate: visitDate ? new Date(visitDate).toISOString() : null,
          specialistNotes: notes || null,
          specialistStatus: status,
        }),
      });
      const updatedSpec = specialists.find((s) => s.id === selectedId) ?? action.specialist ?? null;
      onUpdate({
        assignedSpecialistId: selectedId || null,
        scheduledVisitDate: visitDate ? new Date(visitDate) : null,
        specialistNotes: notes || null,
        specialistStatus: status,
        specialist: updatedSpec,
      });
    } finally {
      setSaving(false);
    }
  }

  function buildMailto(spec: Specialist) {
    const dateStr = visitDate
      ? format(new Date(visitDate), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })
      : "à définir ensemble";
    const subject = encodeURIComponent(`Visite Spécialiste — ${action.title}`);
    const body = encodeURIComponent(
      `Bonjour ${spec.name},\n\n` +
      `Dans le cadre de notre collaboration, nous souhaiterions organiser une visite spécialiste.\n\n` +
      `Objet de la visite : ${action.title}\n` +
      (action.description ? `Détails : ${action.description}\n` : "") +
      `\nDate souhaitée : ${dateStr}\n` +
      (notes ? `\nNotes : ${notes}\n` : "") +
      `\nPourriez-vous confirmer votre disponibilité ?\n\nCordialement,\nFieldIQ — L'Oréal`
    );
    return `mailto:${spec.email}?subject=${subject}&body=${body}`;
  }

  function buildTeamsLink(spec: Specialist) {
    return `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(spec.email ?? "")}`;
  }

  const statusInfo = SPECIALIST_STATUS_LABEL[status];

  return (
    <div className="mt-2 ml-4 pl-3 border-l-2 border-gray-100">
      {/* Summary row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", statusInfo.color)}>
          {statusInfo.label}
        </span>
        {specialist && (
          <span className="text-xs text-gray-600 font-medium">{specialist.name}</span>
        )}
        {action.scheduledVisitDate && (
          <span className="text-xs text-gray-400" suppressHydrationWarning>
            {format(new Date(action.scheduledVisitDate), "d MMM yyyy · HH:mm")}
          </span>
        )}
        <button
          onClick={open ? () => setOpen(false) : openPanel}
          className="text-xs text-brand-600 hover:text-brand-800 font-medium"
        >
          {open ? "Fermer" : specialist ? "Modifier" : "Coordonner →"}
        </button>
      </div>

      {/* Coordination form */}
      {open && (
        <div className="mt-3 space-y-3 bg-gray-50 rounded-xl p-3">
          {/* Specialist selector */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Spécialiste</label>
            {loadingSpec ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 size={13} className="animate-spin text-gray-400" />
                <span className="text-xs text-gray-400">Chargement des spécialistes…</span>
              </div>
            ) : (
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Sélectionner un spécialiste…</option>
                {specialists.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.hasVisited ? "★ " : ""}{s.name}
                    {` · ${s.role === "mv" ? "MV" : "Merchandiser"}`}
                    {s.territory ? ` — ${s.territory}` : ""}
                    {s.hasVisited ? " (déjà venu)" : ""}
                  </option>
                ))}
              </select>
            )}
            {selectedId && specialists.find((s) => s.id === selectedId)?.notes && (
              <p className="text-xs text-gray-400 mt-1 italic">
                {specialists.find((s) => s.id === selectedId)?.notes}
              </p>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Date de visite</label>
            <input
              type="datetime-local"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Statut</label>
            <div className="flex gap-2">
              {(["pending", "contacted", "confirmed"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    "flex-1 py-1.5 text-xs rounded-lg border transition-colors",
                    status === s
                      ? cn(SPECIALIST_STATUS_LABEL[s].color, "border-current font-medium")
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  )}
                >
                  {SPECIALIST_STATUS_LABEL[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Notes (optionnel)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Précisions pour le spécialiste…"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {isDirty && (
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1.5 bg-brand-600 text-white text-xs font-medium px-3 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-60"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Enregistrer
              </button>
            )}
            {specialist?.email && (
              <a
                href={buildMailto(specialist)}
                className="flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-medium px-3 py-2 rounded-lg hover:bg-blue-100"
              >
                <Mail size={12} /> Envoyer un email
              </a>
            )}
            {specialist?.email && (
              <a
                href={buildTeamsLink(specialist)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-purple-50 text-purple-700 text-xs font-medium px-3 py-2 rounded-lg hover:bg-purple-100"
              >
                <MessageSquare size={12} /> Chat Teams
              </a>
            )}
            {specialist?.phone && (
              <a
                href={`tel:${specialist.phone.replace(/\s/g, "")}`}
                className="flex items-center gap-1.5 bg-gray-100 text-gray-600 text-xs font-medium px-3 py-2 rounded-lg hover:bg-gray-200"
              >
                <Phone size={12} /> {specialist.phone}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
