import { Card, CardBody, CardHeader } from "~/app/_components/UI/Card";
import { Skeleton } from "~/app/_components/UI/Skeleton";

export default function LoadingPage() {
  return (
    <div className="space-y-6 p-4 md:space-y-8 md:p-6" dir="rtl">
      {/* Header skeleton */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* System status card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <CardBody className="pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))}
          </div>
          <div className="mt-8 flex justify-center gap-4">
            <Skeleton className="h-12 w-40 rounded-2xl" />
            <Skeleton className="h-12 w-32 rounded-2xl" />
          </div>
        </CardBody>
      </Card>

      {/* Live monitoring card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <CardBody className="pt-2">
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}