import { Skeleton } from "~/app/_components/UI/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6" dir="rtl" role="status" aria-busy="true">
      <span className="sr-only">جاري تحميل لوحة التحكم...</span>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="col-span-2 h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}