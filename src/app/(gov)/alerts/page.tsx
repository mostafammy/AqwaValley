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
    .where(
      and(
        eq(alerts.severity, "critical"),
        isNull(alerts.acknowledgedAt)
      )
    );

  return {
    open: openCount?.count ?? 0,
    critical: criticalCount?.count ?? 0,
  };
}

export default async function AlertsPage() {
  const stats = await getAlertStats();

  return (
    <div
      className="md:p-6 space-y-6 flex flex-col gap-2 max-w-sm md:max-w-full"
      dir="rtl"
      style={{ animation: "fadeSlideUp 0.4s ease-out both" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">التنبيهات</h1>
          <p className="text-sm text-gray-500 mt-1">
            إدارة ومتابعة جميع التنبيهات
          </p>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-3">
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-2 text-center">
            <div className="text-2xl font-bold text-orange-500">{stats.open}</div>
            <div className="text-xs text-gray-500">تنبيه مفتوح</div>
          </div>
          <div className="bg-white rounded-lg border border-red-200 px-4 py-2 text-center">
            <div className="text-2xl font-bold text-red-500">{stats.critical}</div>
            <div className="text-xs text-gray-500">حرج</div>
          </div>
        </div>
      </div>

      {/* Alerts Table with Filters */}
      <Suspense
        fallback={
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <Skeleton className="h-64 w-full" />
          </div>
        }
      >
        <AlertsTable />
      </Suspense>
    </div>
  );
}
