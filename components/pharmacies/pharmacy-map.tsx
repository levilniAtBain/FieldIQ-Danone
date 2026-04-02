"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Pharmacy = {
  id: string;
  name: string;
  city: string;
  tier: string;
  latitude: string;
  longitude: string;
  visitStatus: "green" | "amber" | "red";
};

const STATUS_COLORS = {
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
};

export function PharmacyMap({ pharmacies }: { pharmacies: Pharmacy[] }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const router = useRouter();
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // Dynamically import maplibre to avoid SSR issues
    import("maplibre-gl")
      .then((maplibregl) => {
        const { default: maplibre } = maplibregl as { default: typeof import("maplibre-gl") };

        // Compute center from pharmacies or default to France
        const lats = pharmacies.map((p) => parseFloat(p.latitude));
        const lngs = pharmacies.map((p) => parseFloat(p.longitude));
        const centerLat =
          lats.length > 0 ? lats.reduce((a, b) => a + b, 0) / lats.length : 46.6;
        const centerLng =
          lngs.length > 0 ? lngs.reduce((a, b) => a + b, 0) / lngs.length : 2.3;

        const map = new maplibre.Map({
          container: mapContainer.current!,
          style:
            "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
          center: [centerLng, centerLat],
          zoom: pharmacies.length > 0 ? 8 : 5,
        });

        mapRef.current = map;

        map.on("load", () => {
          pharmacies.forEach((p) => {
            const lat = parseFloat(p.latitude);
            const lng = parseFloat(p.longitude);
            if (isNaN(lat) || isNaN(lng)) return;

            const el = document.createElement("div");
            el.style.cssText = `
              width: 14px; height: 14px; border-radius: 50%;
              background: ${STATUS_COLORS[p.visitStatus]};
              border: 2px solid white;
              box-shadow: 0 1px 4px rgba(0,0,0,0.3);
              cursor: pointer;
            `;

            const popup = new maplibre.Popup({ offset: 12, closeButton: false })
              .setHTML(
                `<div style="font-family:sans-serif;min-width:140px">
                  <p style="font-weight:600;font-size:13px;margin:0 0 2px">${p.name}</p>
                  <p style="font-size:12px;color:#6b7280;margin:0">${p.city} · ${p.tier}</p>
                </div>`
              );

            const marker = new maplibre.Marker({ element: el })
              .setLngLat([lng, lat])
              .setPopup(popup)
              .addTo(map);

            el.addEventListener("click", () => {
              router.push(`/pharmacies/${p.id}`);
            });
          });
        });

        return () => map.remove();
      })
      .catch(() => setMapError(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (mapError) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
        <p className="text-gray-400 text-sm">
          Map unavailable — install maplibre-gl
        </p>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
      {/* Legend */}
      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-2 text-xs z-10 space-y-1.5 shadow-sm">
        {(["green", "amber", "red"] as const).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: STATUS_COLORS[s] }}
            />
            <span className="text-gray-600">
              {s === "green" ? "< 30d" : s === "amber" ? "30-60d" : "> 60d"}
            </span>
          </div>
        ))}
      </div>

      <div ref={mapContainer} style={{ height: "520px" }} />
    </div>
  );
}
