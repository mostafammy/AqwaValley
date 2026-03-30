import { Skeleton } from "~/app/_components/UI/Skeleton";

export default function ForecastLoading() {
  return (
    <div
      className="animate-in fade-in space-y-4 p-4 duration-500 md:space-y-8 md:p-6"
      dir="rtl"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">جاري تحميل توقعات الاستدامة...</span>

      {/* Header Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 rounded-md" />
        <Skeleton className="h-4 w-64 rounded-md" />
      </div>

      {/* Summary cards skeleton */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-32 rounded-xl border border-gray-200"
          />
        ))}
      </div>

      {/* Filter Skeleton */}
      <Skeleton className="h-16 w-full rounded-xl border border-gray-100" />

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-[450px] rounded-xl border border-gray-200" />
        <Skeleton className="h-[450px] rounded-xl border border-gray-200" />
      </div>
    </div>
  );
}
