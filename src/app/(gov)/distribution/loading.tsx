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
      <div className="flex flex-wrap gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Charts skeleton - 2 columns on xl */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Skeleton className="h-[320px] rounded-xl" />
        <Skeleton className="h-[320px] rounded-xl" />
      </div>

      {/* Consumer type chart skeleton */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Skeleton className="h-[320px] rounded-xl xl:col-span-1" />
      </div>

      {/* Bar chart skeleton */}
      <Skeleton className="h-[350px] rounded-xl" />

      {/* District table skeleton */}
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
