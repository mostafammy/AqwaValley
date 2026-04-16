"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import { MapClient } from "~/app/(gov)/dashboard/_components/map-client";
import type { WellMarker } from "~/app/_components/UI/leaflet-map";
import { Badge } from "~/app/_components/UI/Badge";
import Image from "next/image";
import { tapFeedback } from "~/lib/motion";

type WellStatus =
  | "active"
  | "inactive"
  | "maintenance"
  | "offline"
  | "restricted";

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
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

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
      {/* Filters Toggle Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsFiltersOpen(!isFiltersOpen)}
          className="flex items-center gap-2 rounded-full glass-sm px-4 py-2 text-sm font-semibold text-navy transition-all hover:bg-white/60"
        >
          <SlidersHorizontal className="h-4 w-4" />
          تصفية البئر
          {isFiltersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {/* Results count (Always Visible) */}
        <div className="flex items-center gap-2">
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

      <AnimatePresence>
        {isFiltersOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            className="overflow-hidden"
          >
            {/* Filters Panel */}
            <div className="glass-md flex flex-wrap items-center gap-4 rounded-xl p-4">
              {/* District filter */}
              <div className="flex items-center gap-2">
                <label
                  htmlFor="district-select"
                  className="text-sm font-medium text-gray-600"
                >
                  المركز:
                </label>
                <select
                  id="district-select"
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                <label
                  htmlFor="status-select"
                  className="text-sm font-medium text-gray-600"
                >
                  الحالة:
                </label>
                <select
                  id="status-select"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="all">الكل</option>
                  {(Object.keys(STATUS_LABELS) as WellStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status legend */}
              <div className="mr-auto flex flex-wrap items-center gap-3 rounded-lg bg-white/50 p-2 shadow-sm">
                <span className="text-xs text-gray-500">دليل الحالات:</span>
                {(Object.keys(STATUS_LABELS) as WellStatus[]).map((status) => (
                  <span
                    key={status}
                    className="inline-flex items-center gap-1.5 text-xs text-gray-600"
                  >
                    <span className={`h-3 w-3 rounded-full ${STATUS_COLORS[status]}`} />
                    {STATUS_LABELS[status]}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map */}
      <div className="h-[calc(100vh-280px)] min-h-[400px] w-full overflow-hidden rounded-xl border border-gray-200 shadow-sm">
        {filteredWells.length > 0 ? (
          <MapClient wells={filteredWells} oases={[]} />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-50">
            <div className="text-center text-gray-400">
              <Image
                src="/svg/map-empty.svg"
                className="mx-auto mb-3 h-16 w-16 opacity-30"
                alt=""
              />
              <p className="text-sm">لا توجد آبار مطابقة للفلاتر المحددة</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
