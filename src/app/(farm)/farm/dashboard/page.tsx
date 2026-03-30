import { and, eq, inArray, or } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { farm, farmWell, latestSensorState } from "~/server/db/schema";
import { api } from "~/trpc/server";

import { AiRecommendationCard } from "./_components/AiRecommendationCard";
import { KpiCards } from "./_components/KpiCards";
import { QuotaBarCard } from "./_components/QuotaBarCard";
import { SoilHumidityCard } from "./_components/SoilHumidityCard";
import { WeeklyTrendCard } from "./_components/WeeklyTrendCard";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SoilReading = {
  sensorId: string;
  wellId: string;
  value: number;
  unit: string;
  type: string;
  lastUpdatedAt: Date;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function FarmDashboardPage() {
  const session = await getSession();
  if (!session?.user) redirect("/");

  // ── Step 1: Resolve farm from session userId ──────────────────────────────
  const farmRows = await db
    .select({
      id: farm.id,
      name: farm.name,
      districtId: farm.districtId,
      monthlyQuotaM3: farm.monthlyQuotaM3,
      status: farm.status,
    })
    .from(farm)
    .where(
      or(
        eq(farm.farmerUserId, session.user.id),
        eq(farm.ownerId, session.user.id),
      ),
    )
    .limit(1);

  let currentFarm = farmRows[0];

  // Fallback for development/demo: if no farm is assigned to this user, grab the first one
  if (!currentFarm && process.env.NODE_ENV === "development") {
    console.log("No farm assigned to user, falling back to first farm (development mode only)");
    const fallbackRows = await db
      .select({
        id: farm.id,
        name: farm.name,
        districtId: farm.districtId,
        monthlyQuotaM3: farm.monthlyQuotaM3,
        status: farm.status,
      })
      .from(farm)
      .limit(1);
    currentFarm = fallbackRows[0];
  }

  // Still empty (no farms in DB at all)
  if (!currentFarm) {
    return (
      <div className="page">
        <div className="empty-state" style={{ marginTop: "80px" }}>
          <div className="empty-icon">🌾</div>
          <div className="empty-msg">
            لم يتم إنشاء أي مزارع في النظام بعد. يرجى تشغيل السكريبت.
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Parallel data fetching ───────────────────────────────────────
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [dailyQuota, monthlyQuota, farmWellRows, weeklyTrend] =
    await Promise.all([
      // Today's consumption
      api.quotas.farmStatus({
        farmId: currentFarm.id,
        periodType: "daily",
      }),
      // Monthly quota status (for quota bar)
      api.quotas.farmStatus({
        farmId: currentFarm.id,
        periodType: "monthly",
      }),
      // Wells assigned to this farm
      db
        .select({ wellId: farmWell.wellId })
        .from(farmWell)
        .where(eq(farmWell.farmId, currentFarm.id)),
      // 7-day daily trend
      api.quotas.farmTrend({
        farmId: currentFarm.id,
        periodType: "daily",
        from: sevenDaysAgo,
        to: today,
      }),
    ]);

  // ── Step 3: Soil humidity from latestSensorState ──────────────────────────
  const wellIds = farmWellRows.map((fw) => fw.wellId);

  const soilReadings: SoilReading[] =
    wellIds.length > 0
      ? await db
          .select()
          .from(latestSensorState)
          .where(
            and(
              inArray(latestSensorState.wellId, wellIds),
              eq(latestSensorState.type, "humidity"),
            ),
          )
      : [];

  const avgSoilHumidity =
    soilReadings.length > 0
      ? Math.round(
          soilReadings.reduce((sum, r) => sum + r.value, 0) /
            soilReadings.length,
        )
      : null;

  return (
    <div
      className="p-4 md:p-6 space-y-4 md:space-y-8"
      dir="rtl"
      style={{ animation: "fadeSlideUp 0.7s ease-out both" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-3xl font-bold">
            أهلاً، {session.user.name?.split(" ")[0] ?? "مزارع"} 
          </h1>
          <p className="text-sm md:text-base text-gray-500 mt-1">
            {currentFarm.name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 shrink-0 mt-1">
            تحديث كل 60 ثانية
          </span>
        </div>
      </div>

      <KpiCards
        farmId={currentFarm.id}
        initialDailyConsumptionM3={dailyQuota.consumptionM3}
        initialDailyState={dailyQuota.effectiveState}
        monthlyUtilizationPct={monthlyQuota.utilizationPct}
        monthlyState={monthlyQuota.effectiveState}
        avgSoilHumidity={avgSoilHumidity}
        soilReadingCount={soilReadings.length}
      />

      <QuotaBarCard
        consumptionM3={monthlyQuota.consumptionM3}
        quotaM3={monthlyQuota.quotaM3}
        utilizationPct={monthlyQuota.utilizationPct}
        effectiveState={monthlyQuota.effectiveState}
        trendDirection={monthlyQuota.trendDirection}
        trendDeltaPct={monthlyQuota.trendDeltaPct}
      />

      <AiRecommendationCard farmId={currentFarm.id} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <WeeklyTrendCard weeklyTrend={weeklyTrend} />
        </div>
        <div>
          <SoilHumidityCard soilReadings={soilReadings} />
        </div>
      </div>
    </div>
  );
}