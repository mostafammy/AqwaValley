"use client";

import dynamic from "next/dynamic";
import type { WellMarker, OasisMarker } from "~/app/_components/UI/leaflet-map";

const LeafletMap = dynamic(
  () => import("~/app/_components/UI/leaflet-map").then((m) => m.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center">
        <span className="text-gray-400 text-sm">جاري تحميل الخريطة...</span>
      </div>
    ),
  }
);

export function MapClient({ wells, oases }: { wells: WellMarker[], oases?: OasisMarker[] }) {
  return (
    <div style={{ width: "100%", height: "100%" }}>
      <LeafletMap wells={wells} oases={oases} />
    </div>
  );
}