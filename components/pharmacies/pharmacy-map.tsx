"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "maplibre-gl/dist/maplibre-gl.css";

type Pharmacy = {
  id: string;
  name: string;
  city: string;
  tier: string;
  latitude: string;
  longitude: string;
  visitStatus: "green" | "amber" | "red";
};

const STATUS_COLORS: Record<string, string> = {
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
};

export function PharmacyMap({ pharmacies }: { pharmacies: Pharmacy[] }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markersRef = useRef<unknown[]>([]);
  const router = useRouter();
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    import("maplibre-gl")
      .then(({ default: maplibregl }) => {
        const lats = pharmacies
          .map((p) => parseFloat(p.latitude))
          .filter((v) => !isNaN(v));
        const lngs = pharmacies
          .map((p) => parseFloat(p.longitude))
          .filter((v) => !isNaN(v));

        const centerLat =
          lats.length > 0
            ? lats.reduce((a, b) => a + b, 0) / lats.length
            : 48.86;
        const centerLng =
          lngs.length > 0
            ? lngs.reduce((a, b) => a + b, 0) / lngs.length
            : 2.35;

        const map = new maplibregl.Map({
          container: mapContainer.current!,
          style:
            "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
          center: [centerLng, centerLat],
          zoom: pharmacies.length > 0 ? 11 : 5,
          attributionControl: false,
        });

        map.addControl(
          new maplibregl.AttributionControl({ compact: true }),
          "bottom-right"
        );

        mapRef.current = map;

        map.on("load", () => {
          setMapReady(true);

          // Clear existing markers
          markersRef.current.forEach((m: unknown) =>
            (m as { remove: () => void }).remove()
          );
          markersRef.current = [];

          pharmacies.forEach((p) => {
            const lat = parseFloat(p.latitude);
            const lng = parseFloat(p.longitude);
            if (isNaN(lat) || isNaN(lng)) return;

            // Outer wrapper — MapLibre owns this element's `transform` for positioning.
            // Never apply transform here or the dot will jump to (0,0).
            const el = document.createElement("div");
            el.style.cssText = "width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer;";

            // Inner dot — we control its scale independently of MapLibre's positioning.
            const dot = document.createElement("div");
            dot.style.cssText = `
              width: 14px;
              height: 14px;
              border-radius: 50%;
              background: ${STATUS_COLORS[p.visitStatus] ?? "#9ca3af"};
              border: 2.5px solid white;
              box-shadow: 0 1px 4px rgba(0,0,0,0.35);
              transition: transform 0.15s ease;
              pointer-events: none;
            `;
            el.appendChild(dot);

            const popup = new maplibregl.Popup({
              offset: 14,
              closeButton: false,
              closeOnClick: false,
            }).setHTML(`
              <div style="font-family: system-ui, sans-serif; min-width: 160px; padding: 2px 0;">
                <p style="font-weight: 600; font-size: 13px; margin: 0 0 3px; color: #111;">${p.name}</p>
                <p style="font-size: 12px; color: #6b7280; margin: 0 0 3px;">${p.city}</p>
                <p style="font-size: 11px; color: #9ca3af; margin: 0; text-transform: capitalize;">${p.tier} account</p>
              </div>
            `);

            const marker = new maplibregl.Marker({ element: el })
              .setLngLat([lng, lat])
              .setPopup(popup)
              .addTo(map);

            el.addEventListener("mouseenter", () => {
              dot.style.transform = "scale(1.4)";
              marker.togglePopup();
            });
            el.addEventListener("mouseleave", () => {
              dot.style.transform = "scale(1)";
              if (marker.getPopup().isOpen()) marker.togglePopup();
            });
            el.addEventListener("click", () => router.push(`/pharmacies/${p.id}`));

            markersRef.current.push(marker);
          });

          // Fit map to markers if multiple
          if (lats.length > 1) {
            const bounds = new maplibregl.LngLatBounds();
            pharmacies.forEach((p) => {
              const lat = parseFloat(p.latitude);
              const lng = parseFloat(p.longitude);
              if (!isNaN(lat) && !isNaN(lng)) bounds.extend([lng, lat]);
            });
            map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
          }
        });

        map.on("error", (e) => {
          console.error("MapLibre error:", e);
          setMapError("Map tiles failed to load. Check network connection.");
        });

        return () => {
          map.remove();
          mapRef.current = null;
        };
      })
      .catch((e) => {
        console.error("MapLibre import failed:", e);
        setMapError("Map library failed to load.");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (mapError) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
        <p className="text-gray-400 text-sm">{mapError}</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
      {/* Inline legend */}
      <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm rounded-xl px-3 py-2.5 text-xs z-10 shadow-sm space-y-2">
        {Object.entries({
          green: "< 30 days",
          amber: "30–60 days",
          red: "> 60 days / never",
        }).map(([status, label]) => (
          <div key={status} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0 border-2 border-white shadow-sm"
              style={{ background: STATUS_COLORS[status] }}
            />
            <span className="text-gray-600">{label}</span>
          </div>
        ))}
        <p className="text-gray-400 border-t border-gray-100 pt-1.5 mt-0.5">
          Click pin to open
        </p>
      </div>

      {/* Loading state */}
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10 rounded-2xl">
          <div className="text-sm text-gray-400">Loading map…</div>
        </div>
      )}

      <div ref={mapContainer} style={{ height: "520px", width: "100%" }} />
    </div>
  );
}
