import { Suspense } from "react";
import { Skeleton } from "~/app/_components/UI/Skeleton";
import { KpiCards } from "./_components/KpiCards";
import { DistrictMap } from "./_components/DistrictMap";
import { AlertsFeed } from "./_components/alerts";
import { ChartsContainer } from "./_components/ChartsContainer";
import { DemoAlertButton } from "./_components/DemoAlertButton";
import {
  StaggerContainer,
  StaggerItem,
} from "~/app/_components/layouts/StaggerContainer";

export const metadata = { title: "لوحة التحكم | AquaValley" };

export default function GovDashboardPage() {
  return (
    <StaggerContainer
      className="space-y-6 p-4 md:p-6 lg:space-y-8 lg:p-8"
      dir="rtl"
    >
      {/* Header */}
      <StaggerItem>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 md:text-3xl">
              لوحة التحكم الرئيسية
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              الوادي الجديد
            </p>
          </div>
          <div className="flex items-center gap-3">
            <DemoAlertButton />
            <div className="flex items-center gap-2 rounded-full bg-slate-100/50 px-4 py-1.5 ring-1 ring-black/5">
              <span className="shrink-0 text-xs font-bold text-slate-500">
                {new Date().toLocaleDateString("ar-EG", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
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
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-3xl md:h-28" />
              ))}
            </div>
          }
        >
          <KpiCards />
        </Suspense>
      </StaggerItem>

      {/* Map + Alerts — stacked on mobile, side by side on desktop */}
      <StaggerItem>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="overflow-hidden rounded-3xl bg-white p-1 shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-md md:col-span-2">
            <Suspense
              fallback={<Skeleton className="h-64 rounded-2xl md:h-72" />}
            >
              <DistrictMap />
            </Suspense>
          </div>
          <div className="overflow-hidden rounded-3xl bg-white p-1 shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-md">
            <Suspense
              fallback={<Skeleton className="h-64 rounded-2xl md:h-72" />}
            >
              <AlertsFeed />
            </Suspense>
          </div>
        </div>
      </StaggerItem>

      {/* Charts — stacked on mobile */}
      <StaggerItem>
        <div className="overflow-hidden rounded-3xl bg-white p-1 shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-md">
          <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
            <ChartsContainer />
          </Suspense>
        </div>
      </StaggerItem>
    </StaggerContainer>
  );
}
