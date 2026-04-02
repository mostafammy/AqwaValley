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
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-400 md:text-sm">
          <Skeleton className="h-4 w-12" />
          <span className="text-gray-300">/</span>
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Chart Skeleton */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-56" />
          </div>
        </CardHeader>
        <CardBody className="pt-2">
          <Skeleton className="h-64 w-full md:h-80 rounded-xl" />
        </CardBody>
      </Card>

      {/* Table Skeleton */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-40" />
          </div>
        </CardHeader>
        <CardBody className="pt-2">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm border-collapse min-w-[650px]">
              <thead className="border-b border-gray-100">
                <tr>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <th key={i} className="pb-4 pr-4">
                      <Skeleton className="h-4 w-20" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="py-4 pr-4">
                        <Skeleton className="h-4 w-20" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}