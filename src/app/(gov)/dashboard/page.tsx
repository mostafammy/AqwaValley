import { Suspense } from "react";
import { Skeleton } from "~/app/_components/UI/Skeleton";
import { KpiCards }        from "./_components/KpiCards";
import { DistrictMap }     from "./_components/DistrictMap";
import { AlertsFeed }      from "./_components/alerts";
import { ChartsContainer } from "./_components/ChartsContainer";
import { DemoAlertButton } from "./_components/DemoAlertButton";

export const metadata = { title: "لوحة التحكم | AquaValley" };

export default function GovDashboardPage() {
  return (
    <div
      className="p-4 md:p-6 space-y-4 md:space-y-8"
      dir="rtl"
      style={{ animation: "fadeSlideUp 0.7s ease-out both" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-3xl font-bold">لوحة التحكم الرئيسية</h1>
          <p className="text-sm md:text-base text-gray-500 mt-1">الوادي الجديد</p>
        </div>
        <div className="flex items-center gap-3">
          <DemoAlertButton />
          <span className="text-xs text-gray-400 shrink-0 mt-1">
            {new Date().toLocaleDateString("ar-EG", {
              weekday: "long",
              year:    "numeric",
              month:   "long",
              day:     "numeric",
            })}
          </span>
        </div>
      </div>

      {/* KPI Cards — 2 cols mobile, 4 cols desktop */}
      <Suspense
        fallback={
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 md:h-28 rounded-xl" />
            ))}
          </div>
        }
      >
        <KpiCards />
      </Suspense>

      {/* Map + Alerts — stacked on mobile, side by side on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <Suspense fallback={<Skeleton className="h-64 md:h-72 rounded-xl" />}>
            <DistrictMap />
          </Suspense>
        </div>
        <div>
          <Suspense fallback={<Skeleton className="h-64 md:h-72 rounded-xl" />}>
            <AlertsFeed />
          </Suspense>
        </div>
      </div>

      {/* Charts — stacked on mobile */}
      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        <ChartsContainer />
      </Suspense>

    </div>
  );
}