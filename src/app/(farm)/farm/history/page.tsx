/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/no-unsafe-argument */
import { eq, or } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { farm, userRoleAssignment, role } from "~/server/db/schema";
import { api } from "~/trpc/server";

import { SignOutButton } from "~/app/_components/auth/SignOutButton";
import { IrrigationHistoryTable } from "./_components/irrigation-history-table";
import { HistoryChart } from "./_components/history-chart";

async function hasAdminOrManagerRole(userId: string): Promise<boolean> {
  const userRoles = await db
    .select({ type: role.type })
    .from(userRoleAssignment)
    .innerJoin(role, eq(userRoleAssignment.roleId, role.id))
    .where(eq(userRoleAssignment.userId, userId));

  const roleTypes = userRoles.map((r) => r.type);
  return roleTypes.includes("admin") || roleTypes.includes("district_manager");
}

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
  if (!currentFarm && process.env.NODE_ENV === "development") {
    const isAdminOrManager = await hasAdminOrManagerRole(session.user.id);
    if (isAdminOrManager && process.env.DEV_ALLOW_FALLBACK === "true") {
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
  }

  if (!currentFarm) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="mb-4 text-6xl">🚫</div>
          <h2 className="mb-2 text-xl font-bold text-gray-800">
            لا توجد مزرعة مرتبطة بحسابك
          </h2>
          <p className="mb-6 text-gray-600">
            يرجى التواصل مع مسؤول النظام لتخصيص مزرعة لحسابك، أو تحقق من بيانات اعتماد تسجيل الدخول الخاصة بك.
          </p>
          <SignOutButton className="inline-block rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700">
            العودة للرئيسية وتسجيل الخروج
          </SignOutButton>
        </div>
      </div>
    );
  }
      .limit(1);
    currentFarm = fallbackRows[0];
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
    durationMinutes: Math.round(Number(plan.totalLitres) / 100) ?? 60,
    createdAt: plan.createdAt,
    startedAt: plan.activatedAt ?? null,
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
          <span className="font-medium text-blue-600">سجل الري</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
          سجل الري
        </h1>
        <p className="text-sm text-gray-500 md:text-base">
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
