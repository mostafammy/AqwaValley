import { Suspense } from "react";
import { Skeleton } from "~/app/_components/UI/Skeleton";
import { KpiCards }        from "./_components/KpiCards";
import { DistrictMap }     from "./_components/DistrictMap";
import { AlertsFeed }      from "./_components/alerts";
import { ChartsContainer } from "./_components/ChartsContainer";
import { DemoAlertButton } from "./_components/DemoAlertButton";
import { StaggerContainer, StaggerItem } from "~/app/_components/layouts/StaggerContainer";

export const metadata = { title: "لوحة التحكم | AquaValley" };

export default function GovDashboardPage() {
  return (
    <StaggerContainer className="p-4 md:p-6 lg:p-8 space-y-6 lg:space-y-8" dir="rtl">
      {/* Header */}
      <StaggerItem>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 md:text-3xl">لوحة التحكم الرئيسية</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">الوادي الجديد</p>
          </div>
          <div className="flex items-center gap-3">
            <DemoAlertButton />
            <div className="flex items-center gap-2 bg-slate-100/50 rounded-full px-4 py-1.5 ring-1 ring-black/5">
              <span className="text-xs font-bold text-slate-500 shrink-0">
                {new Date().toLocaleDateString("ar-EG", {
                  weekday: "long",
                  year:    "numeric",
                  month:   "long",
                  day:     "numeric",
                })}
              </span>
            </div>
          </div>
        </div>
      </StaggerItem>

      {/* KPI Cards — 2 cols mobile, 4 cols desktop */}
      <StaggerItem>
        <Suspense
          fallback={
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 md:h-28 rounded-3xl" />
              ))}
            </div>
          }
        >
          <KpiCards />
        </Suspense>
      </StaggerItem>

      {/* Map + Alerts — stacked on mobile, side by side on desktop */}
      <StaggerItem>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white rounded-3xl shadow-sm ring-1 ring-black/5 overflow-hidden transition-shadow hover:shadow-md p-1">
            <Suspense fallback={<Skeleton className="h-64 md:h-72 rounded-2xl" />}>
              <DistrictMap />
            </Suspense>
          </div>
          <div className="bg-white rounded-3xl shadow-sm ring-1 ring-black/5 overflow-hidden transition-shadow hover:shadow-md p-1">
            <Suspense fallback={<Skeleton className="h-64 md:h-72 rounded-2xl" />}>
              <AlertsFeed />
            </Suspense>
          </div>
        </div>
      </StaggerItem>

      {/* Charts — stacked on mobile */}
      <StaggerItem>
        <div className="bg-white rounded-3xl shadow-sm ring-1 ring-black/5 overflow-hidden transition-shadow hover:shadow-md p-1">
          <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
            <ChartsContainer />
          </Suspense>
        </div>
      </StaggerItem>
    </StaggerContainer>
  );
}