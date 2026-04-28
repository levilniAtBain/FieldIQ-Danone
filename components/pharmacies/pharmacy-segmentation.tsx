"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// ── Segment definitions ───────────────────────────────────────────────────────

const POTENTIAL_BADGES = [
  { value: "high",   label: "High potential" },
  { value: "medium", label: "Medium potential" },
  { value: "low",    label: "Low potential" },
];

// Profile badges grouped in visual rows (matching the reference image)
const PROFILE_ROWS = [
  [
    { value: "expert_led",   label: "Expert-led" },
    { value: "self_service", label: "Self-service" },
  ],
  [
    { value: "standard_independent", label: "Standard independent" },
    { value: "chain_grouped",        label: "Chain / grouped" },
    { value: "other",                label: "…" },
  ],
];

// Shopper badges grouped in visual rows
const SHOPPER_ROWS = [
  [
    { value: "urban_affluent",  label: "Urban affluent" },
    { value: "suburban",        label: "Suburban" },
    { value: "rural_periurban", label: "Rural / periurban" },
  ],
  [
    { value: "elderly",      label: "Elderly" },
    { value: "families",     label: "Families" },
    { value: "urban_active", label: "Urban Active" },
  ],
];

const SPECIALTY_OPTIONS = [
  { value: "medical_nutrition",   label: "Medical nutrition" },
  { value: "enteral_nutrition",   label: "Enteral nutrition" },
  { value: "infant_formula",      label: "Infant formula" },
  { value: "dysphagia",           label: "Dysphagia" },
  { value: "metabolic_diseases",  label: "Metabolic diseases" },
  { value: "pediatrics",          label: "Pediatrics" },
  { value: "oncology",            label: "Oncology" },
  { value: "geriatrics",          label: "Geriatrics" },
  { value: "nephrology",          label: "Nephrology" },
  { value: "water_hydration",     label: "Water & hydration" },
  { value: "home_care",           label: "HAD / Home care" },
  { value: "mixed",               label: "Mixed / General" },
];

// ── Colour tokens ─────────────────────────────────────────────────────────────

const TEAL = {
  border:      "border-t-teal-600",
  header:      "text-teal-800",
  num:         "border-teal-500 text-teal-700",
  active:      "border-teal-500 bg-teal-50 text-teal-800 font-semibold",
  inactive:    "border-gray-200 text-gray-400 hover:border-teal-300 hover:text-teal-600",
};

const PURPLE = {
  border:      "border-t-violet-600",
  header:      "text-violet-800",
  num:         "border-violet-500 text-violet-700",
  active:      "border-violet-500 bg-violet-50 text-violet-800 font-semibold",
  inactive:    "border-gray-200 text-gray-400 hover:border-violet-300 hover:text-violet-600",
};

const AMBER = {
  border:      "border-t-amber-500",
  header:      "text-amber-800",
  num:         "border-amber-500 text-amber-700",
  active:      "border-amber-500 bg-amber-50 text-amber-800 font-semibold",
  inactive:    "border-gray-200 text-gray-400 hover:border-amber-300 hover:text-amber-600",
};

const GREEN = {
  border:      "border-t-emerald-600",
  header:      "text-emerald-800",
  num:         "border-emerald-500 text-emerald-700",
  active:      "border-emerald-500 bg-emerald-50 text-emerald-800 font-semibold",
  inactive:    "border-gray-200 text-gray-400 hover:border-emerald-300 hover:text-emerald-600",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function PharmacySegmentation({
  pharmacyId,
  initialPotential,
  initialProfile,
  initialShopper,
  initialMainSpecialty,
  initialSecondarySpecialty,
}: {
  pharmacyId: string;
  initialPotential: string | null;
  initialProfile: string[] | null;
  initialShopper: string[] | null;
  initialMainSpecialty: string | null;
  initialSecondarySpecialty: string | null;
}) {
  const [potential, setPotential] = useState<string | null>(initialPotential);
  const [profile, setProfile] = useState<string[]>(initialProfile ?? []);
  const [shopper, setShopper] = useState<string[]>(initialShopper ?? []);
  const [mainSpecialty, setMainSpecialty] = useState<string | null>(initialMainSpecialty);
  const [secondarySpecialty, setSecondarySpecialty] = useState<string | null>(initialSecondarySpecialty);
  const [saving, setSaving] = useState(false);

  async function patch(body: object) {
    setSaving(true);
    try {
      await fetch(`/api/pharmacies/${pharmacyId}/segmentation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } finally {
      setSaving(false);
    }
  }

  function togglePotential(val: string) {
    const next = potential === val ? null : val;
    setPotential(next);
    patch({ segmentPotential: next });
  }

  function toggleProfile(val: string) {
    const next = profile.includes(val) ? profile.filter((v) => v !== val) : [...profile, val];
    setProfile(next);
    patch({ segmentProfile: next });
  }

  function toggleShopper(val: string) {
    const next = shopper.includes(val) ? shopper.filter((v) => v !== val) : [...shopper, val];
    setShopper(next);
    patch({ segmentShopper: next });
  }

  function toggleMainSpecialty(val: string) {
    const next = mainSpecialty === val ? null : val;
    setMainSpecialty(next);
    patch({ mainSpecialty: next });
  }

  function toggleSecondarySpecialty(val: string) {
    const next = secondarySpecialty === val ? null : val;
    setSecondarySpecialty(next);
    patch({ secondarySpecialty: next });
  }

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 transition-opacity", saving && "opacity-70")}>

      {/* ── Card 1: Store potential & size ── */}
      <div className={`bg-white rounded-2xl border border-gray-100 border-t-4 ${TEAL.border} p-4`}>
        <div className="flex items-center gap-2 mb-3">
          <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ${TEAL.num}`}>
            1
          </span>
          <p className={`text-sm font-bold ${TEAL.header}`}>Store potential &amp; size</p>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Total pharmacy sales, total dermocosmetic category sales
        </p>
        <div className="flex flex-wrap gap-2">
          {POTENTIAL_BADGES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => togglePotential(value)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-all",
                potential === value ? TEAL.active : TEAL.inactive
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Card 2: Pharmacy profile & model ── */}
      <div className={`bg-white rounded-2xl border border-gray-100 border-t-4 ${PURPLE.border} p-4`}>
        <div className="flex items-center gap-2 mb-3">
          <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ${PURPLE.num}`}>
            2
          </span>
          <p className={`text-sm font-bold ${PURPLE.header}`}>Pharmacy profile &amp; model</p>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Independent vs. group/chain, level of advice (expert-led vs. self-service)
        </p>
        <div className="space-y-2">
          {PROFILE_ROWS.map((row, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              {row.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => toggleProfile(value)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-full border transition-all",
                    profile.includes(value) ? PURPLE.active : PURPLE.inactive
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Card 3: Shopper & location profile ── */}
      <div className={`bg-white rounded-2xl border border-gray-100 border-t-4 ${AMBER.border} p-4`}>
        <div className="flex items-center gap-2 mb-3">
          <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ${AMBER.num}`}>
            3
          </span>
          <p className={`text-sm font-bold ${AMBER.header}`}>Shopper &amp; location profile</p>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Catchment area socio-demographics, urban density, patient typology (elderly, families, urban active)
        </p>
        <div className="space-y-2">
          {SHOPPER_ROWS.map((row, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              {row.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => toggleShopper(value)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-full border transition-all",
                    shopper.includes(value) ? AMBER.active : AMBER.inactive
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Card 4: Specialties ── */}
      <div className={`bg-white rounded-2xl border border-gray-100 border-t-4 ${GREEN.border} p-4`}>
        <div className="flex items-center gap-2 mb-3">
          <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ${GREEN.num}`}>
            4
          </span>
          <p className={`text-sm font-bold ${GREEN.header}`}>Specialties</p>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Primary and secondary Danone product domain for this account
        </p>

        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Main</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {SPECIALTY_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => toggleMainSpecialty(value)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-all",
                mainSpecialty === value ? GREEN.active : GREEN.inactive
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Secondary</p>
        <div className="flex flex-wrap gap-1.5">
          {SPECIALTY_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => toggleSecondarySpecialty(value)}
              disabled={mainSpecialty === value}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-all",
                secondarySpecialty === value ? GREEN.active : GREEN.inactive,
                mainSpecialty === value && "opacity-30 cursor-not-allowed"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
