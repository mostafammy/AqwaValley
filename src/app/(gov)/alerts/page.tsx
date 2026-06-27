import { Suspense } from "react";
import { db } from "~/server/db";
import { alerts } from "~/server/db/schema";
import { count, eq, isNull, and } from "drizzle-orm";
import { AlertsTable } from "./_components/AlertsTable";
import { Skeleton } from "~/app/_components/UI/Skeleton";

export const metadata = { title: "التنبيهات | AquaValley" };

async function getAlertStats() {
  const [openCount] = await db
    .select({ count: count() })
    .from(alerts)
    .where(isNull(alerts.acknowledgedAt));

  const [criticalCount] = await db
    .select({ count: count() })
    .from(alerts)
    .where(and(eq(alerts.severity, "critical"), isNull(alerts.acknowledgedAt)));

  return {
    open: openCount?.count ?? 0,
    critical: criticalCount?.count ?? 0,
  };
}

export default async function AlertsPage() {
  const stats = await getAlertStats();

  return (
    <div
      className="flex w-full flex-col gap-2 space-y-5 px-3 py-4 sm:px-5 sm:py-5 md:space-y-6 md:p-6"
      dir="rtl"
      style={{ animation: "fadeSlideUp 0.4s ease-out both" }}
    >
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">التنبيهات</h1>
          <p className="mt-1 text-xs text-gray-500 sm:text-sm">
            إدارة ومتابعة جميع التنبيهات
          </p>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-2 sm:gap-3">
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-center sm:px-4">
            <div className="text-xl font-bold text-orange-500 sm:text-2xl">
              {stats.open}
            </div>
            <div className="text-[10px] text-gray-500 sm:text-xs">تنبيه مفتوح</div>
          </div>
          <div className="rounded-lg border border-red-200 bg-white px-3 py-2 text-center sm:px-4">
            <div className="text-xl font-bold text-red-500 sm:text-2xl">
              {stats.critical}
            </div>
            <div className="text-[10px] text-gray-500 sm:text-xs">حرج</div>
          </div>
        </div>
      </div>

      {/* Alerts Table with Filters */}
      <Suspense
        fallback={
          <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-8">
            <Skeleton className="h-64 w-full" />
          </div>
        }
      >
        <AlertsTable />
      </Suspense>
    </div>
  );
}
