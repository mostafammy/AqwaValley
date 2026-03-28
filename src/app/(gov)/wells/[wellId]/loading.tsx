import { Skeleton } from "~/app/_components/UI/Skeleton";

export default function WellDetailLoading() {
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-8 animate-in fade-in duration-500" dir="rtl">
      <Skeleton className="h-10 w-64 rounded-xl border border-gray-100" />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-64 rounded-xl border border-gray-100" />
        <Skeleton className="lg:col-span-2 h-64 rounded-xl border border-gray-100" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-80 rounded-xl border border-gray-100" />
        <Skeleton className="h-80 rounded-xl border border-gray-100" />
      </div>
    </div>
  );
}