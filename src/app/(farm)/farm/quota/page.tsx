import { eq, or } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { farm, userRoleAssignment, role } from "~/server/db/schema";
import { api } from "~/trpc/server";

import { SignOutButton } from "~/app/_components/auth/SignOutButton";
import { QuotaKpis } from "./_components/quota-kpis";
import { QuotaUsageChart } from "./_components/quota-usage-chart";
import { QuotaHistoryTable } from "./_components/quota-history-table";

async function hasAdminOrManagerRole(userId: string): Promise<boolean> {
  const userRoles = await db
    .select({ type: role.type })
    .from(userRoleAssignment)
    .innerJoin(role, eq(userRoleAssignment.roleId, role.id))
    .where(eq(userRoleAssignment.userId, userId));

  const roleTypes = userRoles.map((r) => r.type);
  return roleTypes.includes("admin") || roleTypes.includes("district_manager");
}

export default async function QuotaPage() {
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

  // Fallback for development/demo — requires explicit opt-in
  if (!currentFarm && process.env.NODE_ENV === "development") {
    const isAdminOrManager = await hasAdminOrManagerRole(session.user.id);
    if (isAdminOrManager && process.env.DEV_ALLOW_FALLBACK === "true") {
      console.warn("[QuotaPage] No farm found for user, using dev fallback");
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

  // ── Step 2: Fetch Quota Data ─────────────────────────────────────────────
  const today = new Date();
  const twelveMonthsAgo = new Date(
    today.getFullYear() - 1,
    today.getMonth(),
    1,
  );

  const [monthlyStatus, historicalTrend] = await Promise.all([
    // Current month status
    api.quotas.farmStatus({
      farmId: currentFarm.id,
      periodType: "monthly",
    }),
    // 12-month historical trend
    api.quotas.farmTrend({
      farmId: currentFarm.id,
      periodType: "monthly",
      from: twelveMonthsAgo,
      to: today,
    }),
  ]);

  return (
    <div
      className="space-y-6 p-4 md:space-y-8 md:p-6"
      dir="rtl"
      style={{ animation: "fadeSlideUp 0.7s ease-out both" }}
    >
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-400 md:text-sm">
          <span>المزرعة</span>
          <span>/</span>
          <span className="text-blue-500">الحصة المائية</span>
        </div>
        <h1 className="text-2xl font-black text-gray-900 md:text-3xl">
          الحصة المائية
        </h1>
        <p className="text-sm text-gray-500 md:text-base">
          الموزعة من الحكومة بناءً على المساحة والمحاصيل في {currentFarm.name}
        </p>
      </div>

      {/* KPI Cards */}
      <QuotaKpis
        monthlyLimit={monthlyStatus.quotaM3 * 1000} // Convert to Litres for the KPI logic
        usedLitres={monthlyStatus.consumptionM3 * 1000}
        remainingLitres={
          (monthlyStatus.quotaM3 - monthlyStatus.consumptionM3) * 1000
        }
        utilizationPct={monthlyStatus.utilizationPct}
        state={monthlyStatus.effectiveState}
      />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <QuotaUsageChart trend={historicalTrend} />
        </div>
        <div className="lg:col-span-1">
          <QuotaHistoryTable history={historicalTrend} />
        </div>
      </div>

      {/* Footer Info */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-sm text-blue-800">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-blue-100 p-1">
            <svg
              className="h-4 w-4 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <p className="font-bold">ملاحظة حول الحصة المائية</p>
            <p className="mt-1 leading-relaxed opacity-90">
              يتم تحديث بيانات الاستهلاك بشكل دوري من خلال عدادات التدفق الذكية.
              إذا لاحظت أي اختلاف في القراءات أو كنت ترغب في مراجعة الحصص
              الإضافية، يرجى التواصل مع مكتب الري في منطقتك.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
