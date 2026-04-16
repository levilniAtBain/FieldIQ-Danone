import { BrainCircuit } from "lucide-react";

// ── Advocacy Funnel ──────────────────────────────────────────────────────────
const FUNNEL_STEPS = [
  { n: 1, label: "Unaware",      desc: "No knowledge of LDB science",       circle: "bg-gray-500",    bg: "bg-gray-50",    text: "text-gray-700" },
  { n: 2, label: "Aware",        desc: "Knows the brand, not the proof",     circle: "bg-gray-700",    bg: "bg-gray-100",   text: "text-gray-800" },
  { n: 3, label: "Educated",     desc: "Understands clinical evidence",      circle: "bg-violet-700",  bg: "bg-violet-100", text: "text-violet-900" },
  { n: 4, label: "Convinced",    desc: "Believes in product efficacy",       circle: "bg-teal-600",    bg: "bg-teal-100",   text: "text-teal-900" },
  { n: 5, label: "Recommending", desc: "Actively advises patients",          circle: "bg-green-600",   bg: "bg-green-100",  text: "text-green-900" },
  { n: 6, label: "",             desc: "LDB is the go-to brand",             circle: "bg-green-700",   bg: "bg-green-200",  text: "text-green-900" },
];

// ── Audience & Visit Cards ───────────────────────────────────────────────────
type CardSection = { label: string; content: string; highlight?: boolean };

type CardData = {
  abbr: string;
  title: string;
  subtitle: string;
  avatar: string;
  headerBorder: string;
  accentText: string;
  accentBg: string;
  sections: CardSection[];
};

const CARDS: CardData[] = [
  {
    abbr: "Rx",
    title: "Pharmacist Owner / Head",
    subtitle: "Seg A & B · Strategic audience",
    avatar: "bg-violet-700",
    headerBorder: "border-t-violet-700",
    accentText: "text-violet-700",
    accentBg: "bg-violet-50",
    sections: [
      { label: "Key motivation", content: "Business growth, patient loyalty, category leadership", highlight: true },
      { label: "Core narrative", content: "LDB = the dermocosmetics category leader. Recommending LDB drives revenue AND patient satisfaction." },
      { label: "Evidence used", content: "Market share data, category uplift proof, patient satisfaction surveys, clinical summary card" },
      { label: "Ask / commitment", content: '"Will you commit to recommending La Roche-Posay as first choice for eczema & sensitive skin?"', highlight: true },
      { label: "Long visit format", content: "30 min structured detailing: business review → clinical briefing → joint recommendation commitment → PICOS target" },
      { label: "Frequency", content: "Monthly (Seg A) · Quarterly (Seg B)" },
    ],
  },
  {
    abbr: "DA",
    title: "Counter Staff / Dermo-Advisor",
    subtitle: "All segments · The moment-of-truth audience",
    avatar: "bg-teal-700",
    headerBorder: "border-t-teal-700",
    accentText: "text-teal-700",
    accentBg: "bg-teal-50",
    sections: [
      { label: "Key motivation", content: "Helping patients, feeling expert, confidence at the counter", highlight: true },
      { label: "Core narrative", content: '"When a patient asks for something for sensitive skin — LDB is your first reflex. Here\'s why it works."' },
      { label: "Evidence used", content: "Simple product card (1 page), before/after visuals, patient profile matching tool, key ingredient story" },
      { label: "Ask / commitment", content: '"Can you recommend Cicaplast B5 for post-procedure care next week?" (one brand, one occasion)', highlight: true },
      { label: "Long visit format", content: "20 min sell-out training: product focus → patient typology match → recommendation role-play → leave-behind" },
      { label: "Frequency", content: "Every visit (Seg A–B) · Self-serve digital training (Seg C–D)" },
    ],
  },
  {
    abbr: "PV",
    title: "Long Planned Visit",
    subtitle: "~30–45 min · Seg A & B · Scheduled in advance",
    avatar: "bg-blue-600",
    headerBorder: "border-t-blue-600",
    accentText: "text-blue-700",
    accentBg: "bg-blue-50",
    sections: [
      { label: "Goal", content: "Build deep conviction, close a recommendation commitment on 1–2 priority brands", highlight: true },
      { label: "Narrative arc", content: "① Situation (patient need) → ② Problem (current gap) → ③ LDB solution → ④ Clinical proof → ⑤ Ask" },
      { label: "Content used", content: "iPad detailing aid, clinical study summary, patient case study, competitive comparison card" },
      { label: "Key moment", content: 'Pharmacist or staff verbalises recommendation intent: "I\'ll recommend Lipikar to eczema patients" → log in SFA', highlight: true },
      { label: "Leave-behind", content: "Branded product card + QR to online training module + patient leaflet" },
      { label: "Follow-up", content: "NBA in SFA for next visit: verify recommendation rate change vs. baseline" },
    ],
  },
  {
    abbr: "QV",
    title: "Short Unplanned Visit",
    subtitle: "~5–10 min · All segments · Opportunistic",
    avatar: "bg-orange-500",
    headerBorder: "border-t-orange-500",
    accentText: "text-orange-600",
    accentBg: "bg-orange-50",
    sections: [
      { label: "Goal", content: "One message, one ask — reinforce a recommendation reflex on a single priority brand or occasion", highlight: true },
      { label: "Narrative (30 sec)", content: '"Hi [name], quick one — this week\'s hero is Anthelios SPF50+. One patient in 3 leaves without sun care. Ask them!"', highlight: true },
      { label: "Content used", content: "Physical sample or product teaser card (palm-sized), one verbal stat, no iPad needed" },
      { label: "Key moment", content: 'Staff nods and commits verbally: "Got it, I\'ll push the SPF range this week."', highlight: true },
      { label: "Leave-behind", content: "Sample + shelf-talker if available. No formal leave-behind required" },
      { label: "Follow-up", content: "Log contact in SFA (5 sec). NBA engine auto-schedules next message for next visit" },
    ],
  },
];

export default function RecommendationModelPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
          <BrainCircuit size={18} className="text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Recommendation Model</h1>
          <p className="text-sm text-gray-500">Advocacy funnel &amp; visit typology guide</p>
        </div>
      </div>

      {/* ── Advocacy Funnel ── */}
      <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            The Advocacy Funnel — From Awareness to Committed Recommendation
          </p>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-6 gap-0">
            {FUNNEL_STEPS.map(({ n, label, desc, circle, bg, text }, i) => (
              <div key={n} className="flex items-stretch">
                <div className={`flex-1 rounded-xl p-3 ${bg}`}>
                  <div className={`w-7 h-7 rounded-full ${circle} text-white text-xs font-bold flex items-center justify-center mb-2`}>
                    {n}
                  </div>
                  {label && <p className={`text-xs font-bold mb-1 ${text}`}>{label}</p>}
                  <p className={`text-xs leading-snug ${text} opacity-80`}>{desc}</p>
                </div>
                {i < FUNNEL_STEPS.length - 1 && (
                  <div className="flex items-center px-1 text-gray-300 text-lg select-none">›</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Audience & Visit Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {CARDS.map(({ abbr, title, subtitle, avatar, headerBorder, accentText, accentBg, sections }) => (
          <div key={abbr} className={`bg-white rounded-2xl border border-gray-100 border-t-4 overflow-hidden ${headerBorder}`}>
            {/* Card header */}
            <div className="px-5 py-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${avatar}`}>
                {abbr}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{title}</p>
                <p className={`text-xs font-medium ${accentText}`}>{subtitle}</p>
              </div>
            </div>

            {/* Sections */}
            <div className="divide-y divide-gray-50">
              {sections.map(({ label, content, highlight }) => (
                <div key={label} className="px-5 py-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
                  <p className={`text-sm leading-relaxed ${highlight ? accentText + " font-medium" : "text-gray-700"}`}>
                    {content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
