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

    void import("leaflet").then((L) => {
      if (!containerRef.current) return;

      const map = L.map(containerRef.current, {
        center:             [25.44, 29.5],
        zoom:               7,
        minZoom:            6,
        maxZoom:            9,
        attributionControl: false,
        dragging:           true, 
        scrollWheelZoom:    true,
        doubleClickZoom:    true,
        zoomControl:        true, 
      });

      L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { maxZoom: 18 }
      ).addTo(map);

      // ── Render Oasis Markers (Custom SVG + Label combined) ─────────────────
      oases.forEach((o) => {
        const oasisIcon = L.divIcon({
          className: "",
          html: `
            <div style="display:flex; flex-direction:column; align-items:center; transform:translateY(-100%); width:max-content; cursor:pointer;">
              <div style="
                margin-bottom:2px;
                color:#0A1628;
                font-family:'Cairo',sans-serif;
                font-weight:800;
                font-size:12px;
                text-shadow: 0 0 3px white, 0 0 3px white, 0 0 3px white;
                user-select:none;
              ">
                ${o.name}
              </div>
              <img src="/svg/oasis-marker.svg" style="width:30px; height:30px;" />
            </div>
          `,
          iconSize:   [0, 0],   // We handle sizing via the inner div transform
          iconAnchor: [0, 0],   // Center the anchor point
        });

        const marker = L.marker([o.lat, o.lng], { icon: oasisIcon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:Cairo,sans-serif;direction:rtl;text-align:center">
              <strong style="color:#0A1628">🏝️ واحة ${o.name}</strong><br/>
              <span style="font-size:10px;color:gray">انقر لفتح تفاصيل الواحة</span>
            </div>
          `);

        if (onOasisClick) {
          marker.on("click", (e) => {
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