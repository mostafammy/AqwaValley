import { Skeleton } from "~/app/_components/UI/Skeleton";

export default function DistributionLoading() {
  return (
    <div className="space-y-4 p-4 md:p-6" dir="rtl">
      {/* Summary cards skeleton */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>

      {/* Filters skeleton */}
      <div className="flex flex-wrap gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-100">
        <Skeleton className="h-10 w-40 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Skeleton className="h-[360px] rounded-xl border border-gray-100" />
        <Skeleton className="h-[360px] rounded-xl border border-gray-100" />
      </div>

      {/* Consumer type chart & Table */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Skeleton className="h-[400px] rounded-xl border border-gray-100 xl:col-span-1" />
        <Skeleton className="h-[400px] rounded-xl border border-gray-100 xl:col-span-2" />
      </div>

      {/* Full width element */}
      <Skeleton className="h-80 rounded-xl border border-gray-100" />
    </div>
  );
}
