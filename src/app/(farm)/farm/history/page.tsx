/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/no-unsafe-argument */
import { eq, or } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { farm } from "~/server/db/schema";
import { api } from "~/trpc/server";

import { IrrigationHistoryTable } from "./_components/irrigation-history-table";
import { HistoryChart } from "./_components/history-chart";

export default async function HistoryPage() {
  const session = await getSession();
  if (!session?.user) redirect("/");

  // ── Resolve farm from session userId ──────────────────────────────
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
    .orderBy(farm.createdAt)
    .limit(1);

  let currentFarm = farmRows[0];

  // Dev fallback
  if (
    !currentFarm &&
    process.env.NODE_ENV === "development" &&
    process.env.DEV_ALLOW_FALLBACK === "true"
  ) {
    console.warn("[HistoryPage] No farm found for user, using dev fallback");
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

  if (!currentFarm) {
    return (
      <div className="p-6 md:p-8">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-6 text-6xl opacity-10">🌾</div>
          <p className="text-lg text-gray-500">لم يتم العثور على مزرعة مرتبطة بحسابك.</p>
        </div>
      </div>
    );
  }

  // ── Fetch History Data ───────────────────────────────────────────
  const today = new Date();
  const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, 1);

  const [irrigationEventHistory, quotaHistory, plans] = await Promise.all([
    api.irrigation.listRecentIrrigations({
      farmId: currentFarm.id,
      limit: 20,
    }),
    api.quotas.farmTrend({
      farmId: currentFarm.id,
      periodType: "monthly",
      from: sixMonthsAgo,
      to: today,
    }),
    api.irrigation.listPlans({
      farmId: currentFarm.id,
      limit: 20,
      offset: 0,
    }),
  ]);

  // Transform plans into irrigation history format
  const plansAsHistory = plans.map((plan) => ({
    id: plan.id,
    status: plan.status === "ACTIVATED" ? "ACTIVATED" : "PENDING",
    durationMinutes: Math.round(Number(plan.totalLitres) / 100) || 60,
    createdAt: plan.createdAt,
    startedAt: plan.activatedAt || null,
    endedAt: null,
    quotaDebitStatus: plan.status === "ACTIVATED" ? "APPLIED" : "PENDING",
  }));

  // Combine real events with plans
  const finalIrrigationHistory =
    irrigationEventHistory.length > 0 ? irrigationEventHistory : plansAsHistory;

  return (
    <div
      className="space-y-6 p-4 md:space-y-8 md:p-6"
      dir="rtl"
      style={{ animation: "fadeSlideUp 0.7s ease-out both" }}
    >
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-400 md:text-sm">
          <span>المزرعة</span>
          <span className="text-gray-300">/</span>
          <span className="text-blue-600 font-medium">سجل الري</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl tracking-tight">
          سجل الري
        </h1>
        <p className="text-sm md:text-base text-gray-500">
          جميع جلسات الري والخطط المنفذة في {currentFarm.name}
        </p>
      </div>

      {/* Monthly Consumption Chart */}
      <HistoryChart data={quotaHistory} />

      {/* Irrigation Sessions Table */}
      <IrrigationHistoryTable history={finalIrrigationHistory} />
    </div>
  );
}