import { Skeleton } from "~/app/_components/UI/Skeleton";

export default function MapLoading() {
  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* Filters skeleton */}
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Map skeleton */}
      <Skeleton className="w-full h-[calc(100vh-220px)] rounded-xl" />
    </div>
  );
}
