"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LMap } from "leaflet";
import { wellStatusColor, wellStatusLabel } from "~/lib/utils";

export type OasisMarker = {
  id:   string;
  name: string;
  lat:  number;
  lng:  number;
};

export type WellMarker = {
  id:       string;
  name:     string;
  lat:      number;
  lng:      number;
  status:   "active" | "inactive" | "maintenance" | "offline" | "restricted";
  levelPct: number;
  district: string;
};

const CRITICAL_STATUSES: WellMarker["status"][] = ["offline", "restricted"];

interface LeafletMapProps {
  wells:        WellMarker[];
  oases?:       OasisMarker[];
  onWellClick?: (wellId: string) => void;
  onOasisClick?: (oasisId: string) => void;
}

export function LeafletMap({ wells, oases = [], onWellClick, onOasisClick }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<LMap | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // ── Inject pulse keyframe once ──────────────────────────────────────────
    if (!document.getElementById("well-ping-style")) {
      const style = document.createElement("style");
      style.id = "well-ping-style";
      style.textContent = `
        @keyframes well-ping {
          0%   { transform: scale(1);   opacity: 0.8; }
          100% { transform: scale(2.8); opacity: 0;   }
        }
        .well-ping {
          animation: well-ping 1.5s ease-out infinite;
        }
      `;
      document.head.appendChild(style);
    }

    void import("leaflet").then((L) => {
      if (!containerRef.current) return;

      // @ts-expect-error leaflet internals
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "/leaflet/marker-icon-2x.png",
        iconUrl:       "/leaflet/marker-icon.png",
        shadowUrl:     "/leaflet/marker-shadow.png",
      });

      const map = L.map(containerRef.current, {
        center:             [25.44, 29.5],
        zoom:               7,
        attributionControl: false,
      });

      L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { maxZoom: 18 }
      ).addTo(map);

      // ── Render Oasis Markers (Big Markers) ───────────────────────────────────
      oases.forEach((o) => {
        const oasisIcon = L.icon({
          iconUrl:       "/leaflet/marker-icon.png",
          iconRetinaUrl: "/leaflet/marker-icon-2x.png",
          shadowUrl:     "/leaflet/marker-shadow.png",
          iconSize:      [25, 41],
          iconAnchor:    [12, 41],
          popupAnchor:   [1, -34],
          shadowSize:    [41, 41],
        });

        const marker = L.marker([o.lat, o.lng], { icon: oasisIcon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:Cairo,sans-serif;direction:rtl;text-align:center">
              <strong style="color:var(--color-blue)">🏝️ واحة ${o.name}</strong><br/>
              <span style="font-size:10px;color:gray">انقر لفتح تفاصيل الواحة</span>
            </div>
          `);

        if (onOasisClick) {
          marker.on("click", (e) => {
             // Stop propagation if needed, but usually Leaflet popups handle this
             onOasisClick(o.id);
          });
        }
      });

      wells.forEach((w) => {
        const color      = wellStatusColor(w.status);
        const label      = wellStatusLabel(w.status);
        const isCritical = CRITICAL_STATUSES.includes(w.status);

        const icon = L.divIcon({
          className: "",
          html: `
            <div style="position:relative;width:20px;height:20px;display:flex;align-items:center;justify-content:center;">
              ${isCritical ? `
                <div class="well-ping" style="
                  position:absolute;
                  width:20px;height:20px;
                  border-radius:50%;
                  background:${color};
                "></div>
              ` : ""}
              <div style="
                position:relative;
                width:14px;height:14px;
                border-radius:50%;
                background:${color};
                border:3px solid white;
                box-shadow:0 1px 5px rgba(0,0,0,.4);
                z-index:1;
              "></div>
            </div>
          `,
          iconSize:   [20, 20],
          iconAnchor: [10, 10],
        });

        const marker = L.marker([w.lat, w.lng], { icon });

        marker.bindPopup(`
          <div style="font-family:Cairo,sans-serif;direction:rtl;min-width:140px">
            <strong>${w.name}</strong><br/>
            <span style="color:${color}">● ${label}</span><br/>
            المنسوب: ${w.levelPct}%<br/>
            ${w.district}
          </div>
        `);

        if (onWellClick) {
          marker.on("click", () => onWellClick(w.id));
        }

        marker.addTo(map);
      });

      mapRef.current = map;
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [wells, oases]);

  return (
    <div
      ref={containerRef}
      style={{ height: "100%", width: "100%", minHeight: "280px" }}
    />
  );
}