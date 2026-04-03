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
import { StaggerContainer, StaggerItem } from "~/app/_components/layouts/StaggerContainer";

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
    <StaggerContainer className="p-4 md:p-6 lg:p-8 space-y-6 lg:space-y-8" dir="rtl">
      <StaggerItem>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 md:text-3xl">
              أهلاً، {session.user.name?.split(" ")[0] ?? "مزارع"}
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              {currentFarm.name}
            </p>
          </div>
          <div className="flex items-center gap-3 bg-slate-100/50 rounded-full px-3 py-1 ring-1 ring-black/5">
            <span className="text-[11px] font-semibold text-slate-500">
              تحديث مباشر
            </span>
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>
      </StaggerItem>

      <StaggerItem>
        <KpiCards
          farmId={currentFarm.id}
          initialDailyConsumptionM3={dailyQuota.consumptionM3}
          initialDailyState={dailyQuota.effectiveState}
          monthlyUtilizationPct={monthlyQuota.utilizationPct}
          monthlyState={monthlyQuota.effectiveState}
          avgSoilHumidity={avgSoilHumidity}
          soilReadingCount={soilReadings.length}
        />
      </StaggerItem>

      <StaggerItem>
        <div className="bg-white rounded-3xl shadow-sm ring-1 ring-black/5 overflow-hidden transition-shadow hover:shadow-md">
          <QuotaBarCard
            consumptionM3={monthlyQuota.consumptionM3}
            quotaM3={monthlyQuota.quotaM3}
            utilizationPct={monthlyQuota.utilizationPct}
            effectiveState={monthlyQuota.effectiveState}
            trendDirection={monthlyQuota.trendDirection}
            trendDeltaPct={monthlyQuota.trendDeltaPct}
          />
        </div>
      </StaggerItem>

      <StaggerItem>
        <AiRecommendationCard farmId={currentFarm.id} />
      </StaggerItem>

      <StaggerItem>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="md:col-span-2 bg-white rounded-3xl shadow-sm ring-1 ring-black/5 p-1 transition-shadow hover:shadow-md">
            <WeeklyTrendCard weeklyTrend={weeklyTrend} />
          </div>
          <div className="bg-white rounded-3xl shadow-sm ring-1 ring-black/5 p-1 transition-shadow hover:shadow-md">
            <SoilHumidityCard soilReadings={soilReadings} />
          </div>
        </div>
      </StaggerItem>
    </StaggerContainer>
  );
}
