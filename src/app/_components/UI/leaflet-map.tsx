"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LMap, LayerGroup } from "leaflet";
import { wellStatusColor, wellStatusLabel } from "~/lib/utils";

export type OasisMarker = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

export type WellMarker = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: "active" | "inactive" | "maintenance" | "offline" | "restricted";
  levelPct: number;
  district: string;
};

const CRITICAL_STATUSES: WellMarker["status"][] = ["offline", "restricted"];
const PULSE_STATUSES: WellMarker["status"][] = [
  "offline",
  "restricted",
  "maintenance",
];

const STATUS_AURA_COLOR: Record<WellMarker["status"], string> = {
  active: "rgba(13, 158, 126, 0.35)",
  inactive: "rgba(100, 116, 139, 0.25)",
  maintenance: "rgba(245, 158, 11, 0.35)",
  offline: "rgba(217, 64, 64, 0.4)",
  restricted: "rgba(124, 58, 237, 0.4)",
};

function escapeHtml(str: string) {
  if (typeof document === "undefined") return str;
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

interface LeafletMapProps {
  wells: WellMarker[];
  oases?: OasisMarker[];
  onWellClick?: (wellId: string) => void;
  onOasisClick?: (oasisId: string) => void;
}

export function LeafletMap({
  wells,
  oases = [],
  onWellClick,
  onOasisClick,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const layerGroupRef = useRef<LayerGroup | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // ── 1. Initialize Map Once ────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    let isMounted = true;
    let mapInstance: LMap | null = null;

    void import("leaflet").then((L) => {
      if (!isMounted || !containerRef.current || mapRef.current) return;

      // @ts-expect-error Leaflet attaches _leaflet_id on initialized map containers.
      if (containerRef.current._leaflet_id) return;

      mapInstance = L.map(containerRef.current, {
        center: [25.7, 29.5],
        zoom: 7,
        minZoom: 7, // Lock zoom to 7
        maxZoom: 10,
        attributionControl: true,
        dragging: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        zoomControl: true,
      });

      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "Tiles © Esri" },
      ).addTo(mapInstance);

      // Overlay: Borders + labels
      L.tileLayer(
        "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { attribution: "Labels © Esri" },
      ).addTo(mapInstance);

      layerGroupRef.current = L.layerGroup().addTo(mapInstance);
      mapRef.current = mapInstance;
      setIsMapReady(true);
    });

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerGroupRef.current = null;
        setIsMapReady(false);
      }
    };
  }, []);

  // ── 2. Update Markers when Data or Map state Changes ──────────────────────
  useEffect(() => {
    if (!isMapReady || !mapRef.current || !layerGroupRef.current) return;

    const layerGroup = layerGroupRef.current;

    void import("leaflet").then((L) => {
      layerGroup.clearLayers();

      // Render Oasis Markers
      oases.forEach((o) => {
        const escapedName = escapeHtml(o.name);

        const oasisIcon = L.divIcon({
          className: "",
          html: `
            <div style="display:flex; flex-direction:column; align-items:center; transform:translateY(-100%); width:max-content; cursor:pointer;">
              <div style="margin-bottom:2px; color:#0A1628; font-family:'Cairo',sans-serif; font-weight:800; font-size:12px; text-shadow:0 0 3px white, 0 0 3px white, 0 0 3px white; user-select:none;">
                ${escapedName}
              </div>
              <img src="/svg/oasis-marker.svg" style="width:30px; height:30px;" />
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const marker = L.marker([o.lat, o.lng], { icon: oasisIcon }).addTo(
          layerGroup,
        ).bindPopup(`
            <div style="font-family:Cairo,sans-serif;direction:rtl;text-align:center">
              <strong style="color:#0A1628">🏝️ واحة ${escapedName}</strong><br/>
              <span style="font-size:10px;color:gray">انقر لفتح تفاصيل الواحة</span>
            </div>
          `);

        if (onOasisClick) {
          marker.on("click", () => onOasisClick(o.id));
        }
      });

      // Render Well Markers
      wells.forEach((w) => {
        const color = wellStatusColor(w.status);
        const label = wellStatusLabel(w.status);
        const isCritical = CRITICAL_STATUSES.includes(w.status);
        const shouldPulse = PULSE_STATUSES.includes(w.status);
        const escapedWellName = escapeHtml(w.name);
        const auraColor = STATUS_AURA_COLOR[w.status];
        const pulseDuration = w.status === "offline" ? "1.4s" : "2s";

        const icon = L.divIcon({
          className: "",
          html: `
            <div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;animation: fade-in-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both; animation-delay: ${Math.random() * 0.3}s;">
              <div style="position:absolute;width:24px;height:24px;border-radius:9999px;background:${auraColor};filter:blur(7px);opacity:0.9;"></div>
              ${shouldPulse ? `<div class="pulse-ring" style="color:${color};width:20px;height:20px;animation-duration:${pulseDuration};"></div>` : ""}
              ${shouldPulse ? `<div class="pulse-ring" style="color:${color};width:26px;height:26px;animation-duration:${pulseDuration};animation-delay:0.35s;"></div>` : ""}
              ${isCritical ? `<div class="well-ping" style="position:absolute;width:20px;height:20px;border-radius:50%;background:${color};"></div>` : ""}
              <div style="position:relative;width:14px;height:14px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 1px 7px rgba(0,0,0,.45);z-index:2;"></div>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([w.lat, w.lng], { icon }).addTo(layerGroup)
          .bindPopup(`
            <div style="font-family:Cairo,sans-serif;direction:rtl;min-width:185px;line-height:1.5;">
              <div style="font-size:14px;font-weight:800;color:#0A1628;margin-bottom:4px;">${escapedWellName}</div>
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${color};"></span>
                <span style="font-size:12px;color:${color};font-weight:700;">${label}</span>
              </div>
              <div style="font-size:12px;color:#334155;">المنسوب الحالي: <strong>${w.levelPct}%</strong></div>
              <div style="font-size:11px;color:#64748b;">${escapeHtml(w.district)}</div>
            </div>
          `);

        if (onWellClick) {
          marker.on("click", () => onWellClick(w.id));
        }
      });
    });
  }, [isMapReady, wells, oases, onWellClick, onOasisClick]);

  return (
    <div
      ref={containerRef}
      style={{ height: "100%", width: "100%", minHeight: "280px" }}
    />
  );
}
