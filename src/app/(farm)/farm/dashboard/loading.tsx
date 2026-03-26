import { Skeleton } from "~/app/_components/UI/Skeleton";

export default function FarmDashboardLoading() {
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-8 animate-in fade-in duration-500" dir="rtl">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>

      {/* Quota Bar */}
      <Skeleton className="h-44 rounded-xl" />

      {/* AI Recommendation Card Placeholder */}
      <Skeleton className="h-28 w-full rounded-xl" />

      {/* Lower Grid: Chart and Sensor List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <Skeleton className="h-[340px] rounded-xl" />
        </div>
        <div>
          <Skeleton className="h-[340px] rounded-xl" />
        </div>
      </div>
    </div>
  );
}
