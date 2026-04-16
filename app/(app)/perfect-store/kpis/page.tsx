import { GaugeCircle } from "lucide-react";

export default function PerfectStoreKpisPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
          <GaugeCircle size={18} className="text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">KPIs</h1>
          <p className="text-sm text-gray-500">Perfect Store key performance indicators</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center space-y-3">
        <GaugeCircle size={32} className="mx-auto text-gray-300" />
        <p className="text-sm font-medium text-gray-700">Coming soon</p>
        <p className="text-xs text-gray-400 max-w-xs mx-auto">
          Perfect Store KPI definitions and tracking will be available here.
        </p>
      </div>
    </div>
  );
}
