import { Skeleton } from "~/app/_components/UI/Skeleton";

export default function IrrigationPlanLoading() {
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-8 animate-in fade-in duration-500" dir="rtl">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-40 rounded-lg shrink-0" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col - Plan Overview & Analysis */}
        <div className="lg:col-span-1 space-y-6">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>

        {/* Right Col - Zone Breakdown Detail */}
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-6 w-48 rounded-md mb-2" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
