"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LMap, LayerGroup } from "leaflet";
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

function escapeHtml(str: string) {
  if (typeof document === "undefined") return str;
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

interface LeafletMapProps {
  wells:        WellMarker[];
  oases?:       OasisMarker[];
  onWellClick?: (wellId: string) => void;
  onOasisClick?: (oasisId: string) => void;
}

export function LeafletMap({ wells, oases = [], onWellClick, onOasisClick }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<LMap | null>(null);
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
        center:             [25.7, 29.5],
        zoom:               7,
        minZoom:            7, // Lock zoom to 7
        maxZoom:            10,
        attributionControl: true,
        dragging:           true, 
        scrollWheelZoom:    true,
        doubleClickZoom:    true,
        zoomControl:        true , 
      });

      L.tileLayer("https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.png", { maxZoom: 18 }).addTo(mapInstance);

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
          iconSize:   [0, 0],
          iconAnchor: [0, 0],
        });

        const marker = L.marker([o.lat, o.lng], { icon: oasisIcon })
          .addTo(layerGroup)
          .bindPopup(`
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
        const color      = wellStatusColor(w.status);
        const label      = wellStatusLabel(w.status);
        const isCritical = CRITICAL_STATUSES.includes(w.status);
        const escapedWellName = escapeHtml(w.name);

        const icon = L.divIcon({
          className: "",
          html: `
            <div style="position:relative;width:20px;height:20px;display:flex;align-items:center;justify-content:center;">
              ${isCritical ? `<div class="well-ping" style="position:absolute;width:20px;height:20px;border-radius:50%;background:${color};"></div>` : ""}
              <div style="position:relative;width:14px;height:14px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 1px 5px rgba(0,0,0,.4);z-index:1;"></div>
            </div>
          `,
          iconSize:   [20, 20],
          iconAnchor: [10, 10],
        });

        const marker = L.marker([w.lat, w.lng], { icon })
          .addTo(layerGroup)
          .bindPopup(`
            <div style="font-family:Cairo,sans-serif;direction:rtl;min-width:140px">
              <strong>${escapedWellName}</strong><br/>
              <span style="color:${color}">● ${label}</span><br/>
              المنسوب: ${w.levelPct}%<br/>
              ${escapeHtml(w.district)}
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