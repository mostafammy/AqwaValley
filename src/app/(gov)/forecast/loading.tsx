export default function ForecastLoading() {
  return (
    <div
      className="space-y-6 p-4 md:p-6"
      dir="rtl"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-64 animate-pulse rounded bg-gray-100" />
      </div>

      {/* Summary cards skeleton */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-xl border border-gray-200 bg-gray-100"
          />
        ))}
      </div>

      {/* Filter Skeleton */}
      <div className="h-16 animate-pulse rounded-xl border border-gray-100 bg-gray-50" />

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-[400px] rounded-xl border border-gray-200 bg-white" />
        <div className="h-[400px] rounded-xl border border-gray-200 bg-white" />
      </div>
    </div>
  );
}
