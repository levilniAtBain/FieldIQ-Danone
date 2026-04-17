"use client";

import { useState } from "react";
import { X, LayoutTemplate } from "lucide-react";
import { PlanogramSvg } from "./planogram-svg";

export function PlanogramGuideButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="View perfect planogram guide"
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-700 transition-colors flex-shrink-0 ml-1"
      >
        <LayoutTemplate className="w-3 h-3" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Perfect Planogram</h3>
                <p className="text-xs text-gray-400 mt-0.5">PICOS shelf standards — visual guide</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* SVG diagram */}
            <div className="px-4 pt-3 pb-2">
              <PlanogramSvg />
            </div>

            {/* Key rules */}
            <div className="px-4 pb-4 grid grid-cols-2 gap-2">
              {[
                {
                  color: "bg-amber-50 border-amber-200",
                  title: "60% Share of Shelf",
                  body: "L'Oréal products must occupy ≥ 60% of the shelf space in the category.",
                },
                {
                  color: "bg-yellow-50 border-yellow-200",
                  title: "Eye Level = Buy Level",
                  body: "Priority SKUs at 1.2–1.5m height. Shelves 2 and 3 from top are the golden zone.",
                },
                {
                  color: "bg-blue-50 border-blue-200",
                  title: "Horizontal Blocking",
                  body: "Group all L'Oréal products in a continuous horizontal band — never split vertically.",
                },
                {
                  color: "bg-orange-50 border-orange-200",
                  title: "TN Breakout",
                  body: "End-cap display 100% dedicated to L'Oréal top sellers. No competitor products.",
                },
              ].map((rule) => (
                <div key={rule.title} className={`rounded-lg border p-2.5 ${rule.color}`}>
                  <p className="text-xs font-semibold text-gray-800 mb-0.5">{rule.title}</p>
                  <p className="text-xs text-gray-600 leading-snug">{rule.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
