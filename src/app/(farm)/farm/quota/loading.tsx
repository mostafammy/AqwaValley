import { Card, CardBody, CardHeader } from "~/app/_components/UI/Card";
import { Skeleton } from "~/app/_components/UI/Skeleton";

export default function Loading() {
  return (
    <div
      className="space-y-6 p-4 md:space-y-8 md:p-6"
      dir="rtl"
      style={{ animation: "fadeSlideUp 0.7s ease-out both" }}
    >
      {/* Header Skeleton */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-400 md:text-sm">
          <Skeleton className="h-4 w-12" />
          <span>/</span>
          <Skeleton className="h-4 w-20 bg-blue-200" />
        </div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardBody>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <Skeleton className="h-4 w-24" />
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Main Content Grid Skeleton */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Chart Skeleton */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-base font-bold text-gray-800">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-5 w-32" />
              </div>
            </CardHeader>
            <CardBody>
              <Skeleton className="h-64 w-full" />
            </CardBody>
          </Card>
        </div>

        {/* Table Skeleton */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-base font-bold text-gray-800">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-5 w-32" />
              </div>
            </CardHeader>
            <CardBody>
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-gray-50">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Footer Info Skeleton */}
      <Card accent="blue" className="bg-blue-50/50">
        <CardBody>
          <div className="flex items-start gap-3">
            <Skeleton className="mt-0.5 h-6 w-6 rounded-full bg-blue-200" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-40 bg-blue-200" />
              <Skeleton className="h-4 w-full bg-blue-200" />
              <Skeleton className="h-4 w-3/4 bg-blue-200" />
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}