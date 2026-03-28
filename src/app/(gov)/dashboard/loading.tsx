import { Skeleton } from "~/app/_components/UI/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-8 animate-in fade-in duration-500" dir="rtl" role="status" aria-busy="true">
      <span className="sr-only">جاري تحميل لوحة التحكم...</span>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl border border-gray-100" />
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Skeleton className="h-80 rounded-xl border border-gray-100" />
        </div>
        <div>
          <Skeleton className="h-80 rounded-xl border border-gray-100" />
        </div>
      </div>
    </div>
  );
}