import { BookOpen } from "lucide-react";

// Colours extracted from the reference image
const SEGMENT_COLORS: Record<string, { dot: string; badge: string; text: string }> = {
  A: { dot: "bg-green-600",  badge: "bg-green-600 text-white",       text: "text-green-700" },
  B: { dot: "bg-blue-600",   badge: "bg-blue-600 text-white",        text: "text-blue-700" },
  C: { dot: "bg-orange-500", badge: "bg-orange-500 text-white",      text: "text-orange-700" },
  D: { dot: "bg-gray-800",   badge: "bg-gray-800 text-white",        text: "text-gray-700" },
};

const ROLE_CONFIG = [
  {
    abbr: "KAM",
    role: "Key Account Manager",
    avatar: "bg-green-600",
    tasks: [
      "Negotiate annual contract & trade terms",
      "Define PICOS targets with pharmacy head",
      "Review joint business plan quarterly",
    ],
  },
  {
    abbr: "SR",
    role: "Sales Representative",
    avatar: "bg-blue-600",
    tasks: [
      "Execute in-store visit: shelf + detailing",
      "Check & improve PICOS compliance",
      "Record visit data in SFA tool (photo)",
      "Mobilize merch when needed",
    ],
  },
  {
    abbr: "MR",
    role: "Medical / Prescriber Rep",
    avatar: "bg-violet-600",
    tasks: [
      "Detailing to dermatologist & pharmacist",
      "Scientific content & product training",
      "Advocacy for Seg A priority brands",
    ],
  },
  {
    abbr: "MD",
    role: "Merchandiser",
    avatar: "bg-orange-500",
    tasks: [
      "Shelf reset & planogram implementation",
      "Install POSM & shelf highlighters",
      "Photo audit for compliance tracking",
    ],
  },
];

// Step circle colours match the image (1=teal, 2=blue, 3=orange, 4=violet, 5=red, 6=green)
const STEP_COLORS = [
  "bg-teal-700",
  "bg-blue-600",
  "bg-orange-500",
  "bg-violet-600",
  "bg-red-500",
  "bg-green-600",
];

const STEP_BADGE_COLORS = [
  "bg-teal-100 text-teal-800",
  "bg-blue-100 text-blue-800",
  "bg-orange-100 text-orange-800",
  "bg-violet-100 text-violet-800",
  "bg-red-100 text-red-800",
  "bg-green-100 text-green-800",
];

const VISIT_STEPS = [
  {
    title: "Pre-visit preparation",
    time: "~15 min",
    tasks: [
      "Review pharmacy profile & segment in SFA",
      "Check last visit notes & open actions",
      "Load NBA priorities",
      "Prepare product samples & detailing materials",
    ],
    tools: "SFA app · NBA engine",
  },
  {
    title: "Store entry & relationship",
    time: "~5 min",
    tasks: [
      "Check in via SFA (geo-tagged timestamp)",
      "Greet pharmacy head/counter staff",
      "Confirm available time & agreed agenda",
    ],
    tools: "SFA check-in",
  },
  {
    title: "Shelf audit & PICOS check",
    time: "~10 min",
    tasks: [
      "Photo of shelf before any action (baseline)",
      "Check assortment vs mandatory SKU list",
      "Count facings vs PICOS standard by brand",
      "Assess position (eye-level, extra display, POSM)",
    ],
    tools: "Photo capture · PICOS scorecard",
  },
  {
    title: "In-store execution",
    time: "~15 min",
    tasks: [
      "Restock & correct shelf layout (planogram)",
      "Install/refresh POSM & shelf highlighters",
      "Fill gaps in assortment / flag OOS to order",
      "Photo of shelf after execution (compliance proof)",
    ],
    tools: "Photo capture · SFA",
  },
  {
    title: "Detailing & advocacy",
    time: "~10 min",
    tasks: [
      "Product focus: 1–2 priority brands per visit",
      "Share clinical data / patient case studies",
      "Request recommendation commitment from staff",
      "Leave visual aid or sample if appropriate",
    ],
    tools: "Detailing aid · iPad",
  },
  {
    title: "Post-visit reporting",
    time: "~10 min",
    tasks: [
      "Record PICOS compliance score in SFA",
      "Log actions taken & orders placed",
      "Set next visit date & open next NBA",
      "Flag stores needing merchandiser follow-up",
    ],
    tools: "SFA report · CRM sync",
  },
];

const TOOLS = [
  {
    name: "SFA (Sales Force Automation)",
    desc: "Visit scheduling, check-in/out, PICOS scoring, NBA display, order capture",
    border: "border-l-blue-600",
    title: "text-blue-800",
  },
  {
    name: "Photo capture + AI recognition",
    desc: "Before/after shelf photos automatically scored vs PICOS standard",
    border: "border-l-violet-600",
    title: "text-violet-800",
  },
  {
    name: "NBA / NBS engine — Store Genius",
    desc: "Prioritises which stores to visit & what actions to execute each cycle",
    border: "border-l-green-600",
    title: "text-green-800",
  },
  {
    name: "iPad / detailing app",
    desc: "Product detail pages, clinical data, patient case studies for advocacy",
    border: "border-l-orange-500",
    title: "text-orange-800",
  },
];

export default function ExecutionGuidePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">

      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
          <BookOpen size={18} className="text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Execution Guide</h1>
          <p className="text-sm text-gray-500">Field force operations reference for visit planning</p>
        </div>
      </div>

      {/* ── Coverage Model & Visit Frequency ── */}
      <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-3 bg-teal-700">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Coverage Model &amp; Visit Frequency</h2>
        </div>
        <div className="p-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="pb-3 pr-4 font-medium">Segment</th>
                <th className="pb-3 pr-4 font-medium">Pts</th>
                <th className="pb-3 pr-4 font-medium">Frequency</th>
                <th className="pb-3 pr-4 font-medium">Coverage</th>
                <th className="pb-3 font-medium">PICOS %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { seg: "A", name: "Strategic",   pts: "~2,000", freq: "Weekly",     cov: "Sales + Med rep",  picos: "~80%" },
                { seg: "B", name: "Core",        pts: "~6,000", freq: "Bi-weekly",  cov: "Sales rep + Merch", picos: "~70%" },
                { seg: "C", name: "Development", pts: "~7,000", freq: "Monthly",    cov: "Sales Reps",        picos: "~50%" },
                { seg: "D", name: "Long-tail",   pts: "~5,000", freq: "NA",         cov: "Digital",           picos: "~20%" },
              ].map(({ seg, name, pts, freq, cov, picos }) => (
                <tr key={seg}>
                  <td className="py-3 pr-4">
                    <span className="inline-flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full flex-shrink-0 ${SEGMENT_COLORS[seg].dot}`} />
                      <span className="font-semibold text-gray-900">{seg} — {name}</span>
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-600">{pts}</td>
                  <td className="py-3 pr-4 text-gray-600">{freq}</td>
                  <td className="py-3 pr-4 text-gray-600">{cov}</td>
                  <td className="py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-md font-semibold ${SEGMENT_COLORS[seg].badge}`}>{picos}</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-100">
                <td colSpan={5} className="pt-3 text-xs text-gray-400 italic">Total universe: ~20,000 pharmacies in France</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* ── Who Does What ── */}
      <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-3 bg-violet-700">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Who Does What — Field Roles</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {ROLE_CONFIG.map(({ abbr, role, avatar, tasks }) => (
            <div key={abbr} className="px-6 py-4 flex gap-4 items-start">
              {/* Fixed-size avatar */}
              <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${avatar}`}>
                {abbr}
              </div>
              {/* Role name + tasks */}
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 mb-1.5">{role}</p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {tasks.map((t, i) => (
                    <span key={t}>{i > 0 && " • "}{t}</span>
                  ))}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Visit Flow ── */}
      <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-3 bg-red-600">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Key In-Store Actions — Visit Flow</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {VISIT_STEPS.map(({ title, time, tasks, tools }, i) => (
            <div key={title} className="px-6 py-4 flex gap-4 items-start">
              {/* Step circle */}
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-bold ${STEP_COLORS[i]}`}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <p className="text-sm font-semibold text-gray-900">{title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${STEP_BADGE_COLORS[i]}`}>{time}</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mb-1.5">
                  {tasks.map((t, j) => (
                    <span key={t}>{j > 0 && " • "}{t}</span>
                  ))}
                </p>
                <p className="text-xs text-gray-400">
                  <span className="font-medium">Tool:</span> {tools}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-500 italic">Total visit time: ~60–75 min · Avg. 4–5 visits/day per rep</p>
        </div>
      </section>

      {/* ── Tools & Digital Enablers ── */}
      <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-3 bg-blue-900">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Tools &amp; Digital Enablers</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {TOOLS.map(({ name, desc, border, title }) => (
            <div key={name} className={`px-6 py-4 border-l-4 ml-0 ${border}`}>
              <p className={`text-sm font-bold mb-0.5 ${title}`}>{name}</p>
              <p className="text-sm text-gray-600">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Call Prep, Reporting & Incentives ── */}
      <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-3 bg-green-700">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Call Prep, Reporting &amp; Incentives</h2>
        </div>
        <div className="p-6 grid sm:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Before the visit</p>
            <ul className="space-y-2">
              {[
                "Review segment & PICOS compliance history",
                "Check open actions from last visit",
                "Load NBA priorities & product focus",
                "Confirm visit slot with pharmacy (if Seg A)",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-1.5" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">After the visit</p>
            <ul className="space-y-2">
              {[
                "Log PICOS score + photos in SFA",
                "Record orders placed & actions completed",
                "Update pharmacy notes & flag follow-ups",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0 mt-1.5" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="sm:col-span-2 bg-amber-50 rounded-xl px-4 py-3 border border-amber-100">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Rep incentive</p>
            <p className="text-sm text-amber-900 italic">PICOS compliance improvement + NBA execution rate (quarterly bonus)</p>
          </div>
        </div>
      </section>

    </div>
  );
}
