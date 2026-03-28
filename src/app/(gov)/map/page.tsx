import { db } from "~/server/db";
import { well } from "~/server/db/schema";
import { and, isNotNull } from "drizzle-orm";
import { MapPageClient } from "./_components/MapPageClient";

export const metadata = { title: "خريطة الآبار | AquaValley" };

async function getWellsWithLocation() {
  const wells = await db.query.well.findMany({
    where: and(isNotNull(well.latitude), isNotNull(well.longitude)),
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
    <div className="space-y-4 p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">خريطة الآبار</h1>
          <p className="mt-1 text-sm text-gray-500">{wellCount} بئر مسجلة</p>
        </div>

        {/* Status summary badges */}
        <div className="hidden items-center gap-2 md:flex">
          <span className="text-xs text-gray-500">الحالة:</span>
          {wells.length > 0 && (
            <>
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                {statusCounts.active ?? 0} نشط
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs text-red-700">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                {(statusCounts.offline ?? 0) +
                  (statusCounts.restricted ?? 0)}{" "}
                حرجة
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-700">
                <span className="h-2 w-2 rounded-full bg-yellow-500" />
                {statusCounts.maintenance ?? 0} صيانة
              </span>
            </>
          )}
        </div>
      </div>

      {/* Map with filters */}
      <MapPageClient initialWells={wells} districts={districts} />
    </div>
  );
}
