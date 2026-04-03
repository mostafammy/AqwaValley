"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
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

interface MapClientProps {
  wells:  WellMarker[];
  oases?: OasisMarker[];
}

export function MapClient({ wells, oases = [] }: MapClientProps) {
  const router = useRouter();
  const stats = useMemo(() => {
    const active = wells.filter((w) => w.status === "active").length;
    const maintenance = wells.filter((w) => w.status === "maintenance").length;
    const critical = wells.filter(
      (w) => w.status === "offline" || w.status === "restricted",
    ).length;
    const avgLevel =
      wells.length > 0
        ? Math.round(wells.reduce((sum, w) => sum + (w.levelPct ?? 0), 0) / wells.length)
        : 0;

    return { active, maintenance, critical, avgLevel };
  }, [wells]);

  return (
    <div className="relative" style={{ width: "100%", height: "100%" }}>
      <LeafletMap
        wells={wells}
        oases={oases}
        onWellClick={(wellId) => router.push(`/wells/${wellId}`)}
        onOasisClick={(oasisId) => router.push(`/districts#${oasisId}`)}
      />

      <div className="pointer-events-none absolute right-3 top-3 z-[500] w-52 rounded-[18px] border border-white/25 bg-white/20 p-3 backdrop-blur-2xl shadow-lg md:w-60 md:p-4 glass-panel">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold tracking-wide text-slate-700">مؤشرات مباشرة</span>
          <span className="text-[10px] text-slate-500">تحديث فوري</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-xl bg-white/45 px-2 py-1.5">
            <div className="text-slate-500">نشط</div>
            <div className="font-extrabold text-emerald-700">{stats.active}</div>
          </div>
          <div className="rounded-xl bg-white/45 px-2 py-1.5">
            <div className="text-slate-500">صيانة</div>
            <div className="font-extrabold text-amber-700">{stats.maintenance}</div>
          </div>
          <div className="rounded-xl bg-white/45 px-2 py-1.5">
            <div className="flex items-center gap-1 text-slate-500">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              حرج
            </div>
            <div className="font-extrabold text-red-700">{stats.critical}</div>
          </div>
          <div className="rounded-xl bg-white/45 px-2 py-1.5">
            <div className="text-slate-500">متوسط المنسوب</div>
            <div className="font-extrabold text-blue-700">{stats.avgLevel}%</div>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[10px] text-slate-600">
            <span>متوسط صحة الآبار</span>
            <span className="font-bold">{stats.avgLevel}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-teal-400"
              style={{ width: `${stats.avgLevel}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}