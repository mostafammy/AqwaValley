import { Skeleton } from "~/app/_components/UI/Skeleton";

export default function WellDetailLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <Skeleton className="h-10 w-64 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="col-span-2 h-64 rounded-xl" />
      </div>
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}