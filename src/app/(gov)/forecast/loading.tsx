export default function ForecastLoading() {
  return (
    <div
      className="p-4 md:p-6 space-y-6"
      dir="rtl"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-64 bg-gray-100 rounded animate-pulse" />
      </div>

      {/* Summary cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-xl border border-gray-200 animate-pulse" />
        ))}
      </div>

      {/* Filter Skeleton */}
      <div className="h-16 bg-gray-50 rounded-xl border border-gray-100 animate-pulse" />

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-[400px] bg-white rounded-xl border border-gray-200" />
        <div className="h-[400px] bg-white rounded-xl border border-gray-200" />
      </div>
    </div>
  );
}
