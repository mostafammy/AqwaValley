"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { MapClient } from "~/app/(gov)/dashboard/_components/map-client";
import type { WellMarker } from "~/app/_components/UI/leaflet-map";
import { Badge } from "~/app/_components/UI/Badge";
import Image from "next/image";
import { tapFeedback } from "~/lib/motion";

type WellStatus = "active" | "inactive" | "maintenance" | "offline" | "restricted";

interface WellData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: WellStatus;
  levelPct: number;
  district: string;
  districtId: string;
}

interface District {
  id: string;
  name: string;
}

interface MapPageClientProps {
  initialWells: WellData[];
  districts: District[];
}

const STATUS_LABELS: Record<WellStatus, string> = {
  active: "نشط",
  inactive: "غير نشط",
  maintenance: "صيانة",
  offline: "متوقف",
  restricted: "مقيّد",
};

const STATUS_COLORS: Record<WellStatus, string> = {
  active: "bg-green-500",
  inactive: "bg-gray-400",
  maintenance: "bg-yellow-500",
  offline: "bg-red-500",
  restricted: "bg-orange-500",
};

export function MapPageClient({ initialWells, districts }: MapPageClientProps) {
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Filter wells based on selected filters
  const filteredWells = useMemo<WellMarker[]>(() => {
    return initialWells
      .filter((w) => {
        if (selectedDistrict !== "all" && w.districtId !== selectedDistrict) {
          return false;
        }
        if (selectedStatus !== "all" && w.status !== selectedStatus) {
          return false;
        }
        return true;
      })
      .map((w) => ({
        id: w.id,
        name: w.name,
        lat: w.lat,
        lng: w.lng,
        status: w.status,
        levelPct: w.levelPct,
        district: w.district,
      }));
  }, [initialWells, selectedDistrict, selectedStatus]);

  const handleReset = () => {
    setSelectedDistrict("all");
    setSelectedStatus("all");
  };

  const hasFilters = selectedDistrict !== "all" || selectedStatus !== "all";

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-100">
        {/* District filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="district-select" className="text-sm font-medium text-gray-600">المركز:</label>
          <select
            id="district-select"
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">الكل</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="status-select" className="text-sm font-medium text-gray-600">الحالة:</label>
          <select
            id="status-select"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">الكل</option>
            {(Object.keys(STATUS_LABELS) as WellStatus[]).map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        {/* Results count */}
        <div className="flex items-center gap-2 mr-auto">
          <Badge variant="gray">
            {filteredWells.length} من {initialWells.length} بئر
          </Badge>
          {hasFilters && (
            <motion.button
              whileTap={tapFeedback}
              onClick={handleReset}
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              إعادة تعيين
            </motion.button>
          )}
        </div>
      </div>

      {/* Status legend */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-white rounded-lg shadow-sm border border-gray-100">
        <span className="text-xs text-gray-500">دليل الحالات:</span>
        {(Object.keys(STATUS_LABELS) as WellStatus[]).map((status) => (
          <span key={status} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            <span className={`w-3 h-3 rounded-full ${STATUS_COLORS[status]}`} />
            {STATUS_LABELS[status]}
          </span>
        ))}
      </div>

      {/* Map */}
      <div className="w-full h-[calc(100vh-280px)] min-h-[400px] rounded-xl overflow-hidden shadow-sm border border-gray-200">
        {filteredWells.length > 0 ? (
          <MapClient wells={filteredWells} oases={[]} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-400">
              <Image src="/svg/map-empty.svg" className="w-16 h-16 mx-auto mb-3 opacity-30" alt="" />
              <p className="text-sm">لا توجد آبار مطابقة للفلاتر المحددة</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
