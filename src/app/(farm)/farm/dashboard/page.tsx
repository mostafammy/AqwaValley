import { and, eq, inArray, or } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import {
  farm,
  farmWell,
  latestSensorState,
  userRoleAssignment,
  role,
} from "~/server/db/schema";
import { api } from "~/trpc/server";

import { SignOutButton } from "~/app/_components/auth/SignOutButton";
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

// ─── Helper: Check if user has admin/manager role ──────────────────────────

async function hasAdminOrManagerRole(userId: string): Promise<boolean> {
  const userRoles = await db
    .select({ type: role.type })
    .from(userRoleAssignment)
    .innerJoin(role, eq(userRoleAssignment.roleId, role.id))
    .where(eq(userRoleAssignment.userId, userId));

  const roleTypes = userRoles.map((r) => r.type);
  return roleTypes.includes("admin") || roleTypes.includes("district_manager");
}

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
      ownerId: farm.ownerId,
      farmerUserId: farm.farmerUserId,
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

  // Fallback for development/demo: if no farm is assigned, grab first farm
  // BUT only if user has admin or manager role - otherwise they can't access it
  if (!currentFarm && process.env.NODE_ENV === "development") {
    const isAdminOrManager = await hasAdminOrManagerRole(session.user.id);
    if (isAdminOrManager) {
      console.log(
        "No farm assigned to user, falling back to first farm (admin/manager dev mode)",
      );
      const fallbackRows = await db
        .select({
          id: farm.id,
          name: farm.name,
          districtId: farm.districtId,
          monthlyQuotaM3: farm.monthlyQuotaM3,
          status: farm.status,
          ownerId: farm.ownerId,
          farmerUserId: farm.farmerUserId,
        })
        .from(farm)
        .limit(1);
      currentFarm = fallbackRows[0];
    }
  }

  // Still empty (no farms in DB at all) or no access
  if (!currentFarm) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="mb-4 text-6xl">🚫</div>
          <h2 className="mb-2 text-xl font-bold text-gray-800">
            لا توجد مزرعة مرتبطة بحسابك
          </h2>
          <p className="mb-6 text-gray-600">
            يرجى التواصل مع مسؤول النظام لتخصيص مزرعة لحسابك، أو تحقق من بيانات
            اعتماد تسجيل الدخول الخاصة بك.
          </p>
          <SignOutButton className="inline-block rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700">
            العودة للرئيسية وتسجيل الخروج
          </SignOutButton>
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
      className="space-y-4 p-4 md:space-y-8 md:p-6"
      dir="rtl"
      style={{ animation: "fadeSlideUp 0.7s ease-out both" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold md:text-3xl">
            أهلاً، {session.user.name?.split(" ")[0] ?? "مزارع"}
          </h1>
          <p className="mt-1 text-sm text-gray-500 md:text-base">
            {currentFarm.name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="mt-1 shrink-0 text-xs text-gray-400">
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
