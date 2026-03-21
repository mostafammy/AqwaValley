import { Skeleton } from "~/app/_components/UI/Skeleton";

export default function DistrictsLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <Skeleton className="h-10 w-48 rounded-xl" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-24 rounded-xl" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, j) => (
              <Skeleton key={j} className="h-28 rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}