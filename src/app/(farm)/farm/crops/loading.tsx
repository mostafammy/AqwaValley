import { Skeleton } from "~/app/_components/UI/Skeleton";

export default function CropsLoading() {
  return (
    <div className="space-y-6 p-4 md:space-y-10 md:p-8" dir="rtl">
      <div className="space-y-2">
        <Skeleton className="h-9 w-56 rounded-2xl md:h-12 md:w-72" />
        <Skeleton className="h-4 w-80 rounded" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <Skeleton className="h-130 w-full rounded-[24px]" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Skeleton className="h-38 rounded-[24px]" />
            <Skeleton className="h-38 rounded-[24px]" />
            <Skeleton className="h-38 rounded-[24px]" />
          </div>
        </div>
        <div className="lg:col-span-4">
          <Skeleton className="h-130 w-full rounded-[24px]" />
        </div>
      </div>
      <Skeleton className="h-72 w-full rounded-[24px]" />
    </div>
  );
}