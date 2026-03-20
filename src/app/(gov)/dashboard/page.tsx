import { Suspense } from "react";
import { Skeleton } from "~/app/_components/UI/Skeleton";
import { KpiCards }    from "./_components/KpiCards";
import { DistrictMap } from "./_components/DistrictMap";
import { AlertsFeed }  from "./_components/alerts";
import { ChartsContainer } from "./_components/ChartsContainer";

export const metadata = { title: "لوحة التحكم | AquaValley" };

export default function GovDashboardPage() {
  return (
    <div className="p-6 space-y-6"
      dir="rtl"
      style={{
        animation: "fadeSlideUp 0.7s ease-out both",
      }}>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">لوحة التحكم الرئيسية</h1>
          <p className="text-xl text-gray-500 mt-1">
             الوادي الجديد
          </p>
        </div>
        <span className="text-xs text-gray-400">
          {new Date().toLocaleDateString("ar-EG", {
            weekday: "long",
            year:    "numeric",
            month:   "long",
            day:     "numeric",
          })}
        </span>
      </div>

      {/* KPI Cards */}
      <Suspense
        fallback={
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        }
      >
        <KpiCards />
      </Suspense>

      {/* Map + Alerts */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <Suspense fallback={<Skeleton className="h-72 rounded-xl" />}>
            <DistrictMap />
          </Suspense>
        </div>
        <Suspense fallback={<Skeleton className="h-72 rounded-xl" />}>
          <AlertsFeed />
        </Suspense>
      </div>

      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        <ChartsContainer />
      </Suspense>

    </div>
  );
}