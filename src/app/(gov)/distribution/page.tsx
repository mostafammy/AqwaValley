import { db } from "~/server/db";
import { district, well } from "~/server/db/schema";
import { asc, inArray } from "drizzle-orm";
import { DistributionPageClient } from "./_components/DistributionPageClient";

export const metadata = { title: "توزيع المياه | AquaValley" };

interface DistrictStats {
  id: string;
  name: string;
  totalQuota: number;
  totalConsumption: number;
  utilizationPct: number;
  effectiveState: "ok" | "warning" | "critical";
  wellCount: number;
}

async function getDistrictsWithStats(): Promise<DistrictStats[]> {
  const districts = await db.query.district.findMany({
    orderBy: [asc(district.name)],
  });

  if (districts.length === 0) return [];

  const districtIds = districts.map((d) => d.id);

  // Get wells with their flow rates per district
  const wellsData = await db
    .select({
      districtId: well.districtId,
      baselineFlowRateM3Hr: well.baselineFlowRateM3Hr,
      currentLevelPct: well.currentLevelPct,
      status: well.status,
    })
    .from(well)
    .where(inArray(well.districtId, districtIds));

  // Group wells by district
  const wellsByDistrict = wellsData.reduce(
    (acc, w) => {
      const districtWells = acc[w.districtId] ?? [];
      districtWells.push(w);
      acc[w.districtId] = districtWells;
      return acc;
    },
    {} as Record<string, typeof wellsData>,
  );

  return districts.map((d) => {
    const districtWells = wellsByDistrict[d.id] ?? [];
    const wellCount = districtWells.length;

    // Calculate estimated capacity (assuming 24/7 operation)
    // Monthly quota = sum of baseline flow rates * 24 hours * 30 days
    const totalQuota = districtWells.reduce((sum, w) => {
      const flowRate = Number(w.baselineFlowRateM3Hr) || 0;
      return sum + flowRate * 24 * 30; // Monthly quota estimate
    }, 0);

    // Estimated consumption based on water level decrease
    // Lower level = higher consumption
    const avgLevelPct = districtWells.length > 0
      ? districtWells.reduce((sum, w) => sum + (Number(w.currentLevelPct) || 0), 0) / districtWells.length
      : 100;

    // Estimate consumption (inverse of level = consumption proxy)
    const totalConsumption = totalQuota * (1 - (avgLevelPct / 100));

    const utilizationPct = totalQuota > 0 ? (totalConsumption / totalQuota) * 100 : 0;

    // Determine state based on water level and active wells
    const activeWells = districtWells.filter(w => w.status === "active").length;
    const criticalRatio = wellCount > 0 ? activeWells / wellCount : 0;

    let effectiveState: "ok" | "warning" | "critical" = "ok";
    if (avgLevelPct < 30 || criticalRatio < 0.3) effectiveState = "critical";
    else if (avgLevelPct < 50 || criticalRatio < 0.6) effectiveState = "warning";

    return {
      id: d.id,
      name: d.name,
      totalQuota: Math.round(totalQuota),
      totalConsumption: Math.round(totalConsumption),
      utilizationPct,
      effectiveState,
      wellCount,
    };
  });
}

async function getConsumptionTrend() {
  // Generate trend data from current wells data
  // This creates a simulated trend for demo purposes
  const months = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو"
  ];

  return months.map((month, index) => {
    // Simulate consumption trend with some variance
    const baseQuota = 50000;
    const baseActual = 45000;
    const trend = (index - 2.5) * 2000; // Increasing or decreasing trend
    const variance = Math.random() * 5000 - 2500;

    return {
      month,
      quota: Math.round(baseQuota + trend),
      actual: Math.round(baseActual + trend + variance),
    };
  });
}

export default async function DistributionPage() {
  const [districts, trendData] = await Promise.all([
    getDistrictsWithStats(),
    getConsumptionTrend(),
  ]);

  const totalQuota = districts.reduce((sum, d) => sum + d.totalQuota, 0);
  const totalConsumption = districts.reduce((sum, d) => sum + d.totalConsumption, 0);
  const avgUtilization = totalQuota > 0 ? (totalConsumption / totalQuota) * 100 : 0;
  const totalWells = districts.reduce((sum, d) => sum + d.wellCount, 0);

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">توزيع المياه</h1>
          <p className="text-sm text-gray-500 mt-1">
            متابعة الاستهلاك والحصص المائية
          </p>
        </div>
      </div>

      <DistributionPageClient
        districts={districts}
        trendData={trendData}
        summary={{
          totalQuota,
          totalConsumption,
          avgUtilization,
          totalWells,
          districtCount: districts.length,
        }}
      />
    </div>
  );
}
