import { Skeleton } from "~/app/_components/UI/Skeleton";

export default function ForecastLoading() {
  return (
    <div
      className="animate-in fade-in min-w-0 space-y-3 overflow-x-hidden duration-500 md:space-y-8"
      dir="rtl"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">جاري تحميل توقعات الاستدامة...</span>

      {/* Header Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-40 rounded-md sm:h-8 sm:w-48" />
        <Skeleton className="h-3 w-56 rounded-md sm:h-4 sm:w-64" />
      </div>

      {/* Summary cards skeleton */}
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-28 rounded-xl border border-gray-200 sm:h-32"
          />
        ))}
      </div>

      {/* Filter Skeleton */}
      <Skeleton className="h-14 w-full rounded-xl border border-gray-100 sm:h-16" />

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
        <Skeleton className="h-[280px] rounded-xl border border-gray-200 sm:h-[360px] md:h-[450px]" />
        <Skeleton className="h-[280px] rounded-xl border border-gray-200 sm:h-[360px] md:h-[450px]" />
      </div>
    </div>
  );
}
