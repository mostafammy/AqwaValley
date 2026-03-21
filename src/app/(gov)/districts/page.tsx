import { db } from "~/server/db";
import { well, district, alerts } from "~/server/db/schema";
import { count, isNull, and, inArray } from "drizzle-orm";
import { Suspense } from "react";
import { DistrictCard } from "./_components/district-card";
import { ScrollToHash } from "./_components/scroll-to-hash";

export const metadata = { title: "المراكز والآبار | AquaValley" };

function toSlug(name: string): string {
  const map: Record<string, string> = {
    "El Kharga":  "kharga",
    "El Dakhla":  "dakhla",
    "El Farafra": "farafra",
    "Paris":      "paris",
    "Balat":      "balat",
  };
  return map[name] ?? name.toLowerCase().replace(/\s+/g, "-");
}

async function getDistrictsWithWells() {
  const districts = await db.query.district.findMany();
  if (districts.length === 0) return [];

  const districtIds = districts.map((d) => d.id);

  const allWells = await db.query.well.findMany({
    where: inArray(well.districtId, districtIds),
  });

  const wellIds = allWells.map((w) => w.id);

  const activeAlerts = wellIds.length > 0
    ? await db
        .select({ wellId: alerts.wellId, count: count() })
        .from(alerts)
        .where(
          and(
            inArray(alerts.wellId, wellIds),
            isNull(alerts.acknowledgedAt),
          )
        )
        .groupBy(alerts.wellId)
    : [];

  const alertMap = new Map(activeAlerts.map((a) => [a.wellId, a.count ?? 0]));

  return districts.map((d) => {
    const districtWells = allWells
      .filter((w) => w.districtId === d.id)
      .map((w) => ({
        id:         w.id,
        name:       w.name,
        status:     w.status,
        levelPct:   Number(w.currentLevelPct ?? 0),
        flowRate:   w.baselineFlowRateM3Hr ? Number(w.baselineFlowRateM3Hr) : null,
        alertCount: alertMap.get(w.id) ?? 0,
      }));

    const totalWells  = districtWells.length;
    const activeWells = districtWells.filter((w) => w.status === "active").length;
    const avgLevelPct = totalWells > 0
      ? districtWells.reduce((sum, w) => sum + w.levelPct, 0) / totalWells
      : 0;
    const totalAlerts = districtWells.reduce((sum, w) => sum + w.alertCount, 0);

    return {
      id:           toSlug(d.name),
      dbId:         d.id,
      name:         d.name,
      totalWells,
      activeWells,
      avgLevelPct,
      alertCount:   totalAlerts,
      depletionRate: Number(d.annualDepletionRateM ?? 0),
      wells:        districtWells,
    };
  });
}

export default async function DistrictsPage() {
  const districts = await getDistrictsWithWells();

  return (
    <div
      className="p-4 md:p-6 space-y-6"
      dir="rtl"
      style={{ animation: "fadeSlideUp 0.4s ease-out both" }}
    >
      <Suspense fallback={null}>
        <ScrollToHash />
      </Suspense>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">المراكز والآبار</h1>
          <p className="text-sm text-gray-500 mt-1">
            {districts.length} مراكز ·{" "}
            {districts.reduce((s, d) => s + d.totalWells, 0)} بئر إجمالي
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {districts.map((d) => (
          <DistrictCard key={d.id} {...d} />
        ))}
      </div>
    </div>
  );
}