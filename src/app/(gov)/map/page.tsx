import { db } from "~/server/db";
import { well } from "~/server/db/schema";
import { and, isNotNull } from "drizzle-orm";
import { MapPageClient } from "./_components/MapPageClient";

export const metadata = { title: "خريطة الآبار | AquaValley" };

async function getWellsWithLocation() {
  const wells = await db.query.well.findMany({
    where: and(
      isNotNull(well.latitude),
      isNotNull(well.longitude),
    ),
    with: {
      district: true,
    },
  });

  return wells.map((w) => ({
    id: w.id,
    name: w.name,
    lat: Number(w.latitude),
    lng: Number(w.longitude),
    status: w.status,
    levelPct: Number(w.currentLevelPct ?? 0),
    district: w.district?.name ?? "",
    districtId: w.districtId,
  }));
}

async function getDistricts() {
  const districts = await db.query.district.findMany({
    orderBy: (d, { asc }) => [asc(d.name)],
  });

  return districts.map((d) => ({
    id: d.id,
    name: d.name,
  }));
}

export default async function MapPage() {
  const [wells, districts] = await Promise.all([
    getWellsWithLocation(),
    getDistricts(),
  ]);

  const wellCount = wells.length;
  const statusCounts = wells.reduce(
    (acc, w) => {
      acc[w.status] = (acc[w.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">خريطة الآبار</h1>
          <p className="text-sm text-gray-500 mt-1">
            {wellCount} بئر مسجلة
          </p>
        </div>

        {/* Status summary badges */}
        <div className="hidden md:flex items-center gap-2">
          <span className="text-xs text-gray-500">الحالة:</span>
          {wells.length > 0 && (
            <>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                {statusCounts.active ?? 0} نشط
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                {(statusCounts.offline ?? 0) + (statusCounts.restricted ?? 0)} حرجة
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                {statusCounts.maintenance ?? 0} صيانة
              </span>
            </>
          )}
        </div>
      </div>

      {/* Map with filters */}
      <MapPageClient
        initialWells={wells}
        districts={districts}
      />
    </div>
  );
}
