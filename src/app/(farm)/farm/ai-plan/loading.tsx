import { Skeleton } from "~/app/_components/UI/Skeleton";

export default function IrrigationPlanLoading() {
  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500" dir="rtl">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <Skeleton className="h-4 w-32 mb-4 bg-gray-100/50" />
           <Skeleton className="h-12 w-64 md:h-16 md:w-80 mb-2 rounded-2xl" />
           <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <div className="flex items-center gap-3">
           <Skeleton className="h-10 w-24 rounded-xl" />
           <Skeleton className="h-12 w-48 rounded-2xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Overview */}
        <div className="lg:col-span-1 space-y-6">
           <Skeleton className="h-80 w-full rounded-3xl" />
           <Skeleton className="h-64 w-full rounded-3xl" />
        </div>

        {/* Right Column - Zones */}
        <div className="lg:col-span-2 space-y-6">
           <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-48 rounded-full" />
              <Skeleton className="h-6 w-32 rounded-full" />
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-48 w-full rounded-3xl" />
              ))}
           </div>

           <Skeleton className="h-32 w-full rounded-3xl" />
        </div>
      </div>
    </div>
  );
}
