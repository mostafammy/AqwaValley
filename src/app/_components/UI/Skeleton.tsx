import { cn } from "~/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-slate-200/70 before:absolute before:inset-0 before:-translate-x-full before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent)] before:animate-[shimmer_1.6s_infinite]",
        className,
      )}
      {...props}
    />
  );
}

function AiPlanPageSkeleton() {
  return (
    <div className="space-y-8 p-4 md:p-8" dir="rtl">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div className="space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-12 w-64 rounded-[24px] md:h-14 md:w-80" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-11 w-40 rounded-[18px]" />
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-5">
          <Skeleton className="h-88 w-full rounded-[24px]" />
          <Skeleton className="h-64 w-full rounded-[24px]" />
        </div>

        <div className="space-y-6 xl:col-span-7">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-[18px]" />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-[24px]" />
            ))}
          </div>

          <Skeleton className="h-32 rounded-[24px]" />
        </div>
      </div>
    </div>
  );
}

function HistoryPageSkeleton() {
  return (
    <div className="space-y-6 p-4 md:space-y-8 md:p-6" dir="rtl">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-84" />
      </div>

      <Skeleton className="h-84 w-full rounded-[24px]" />

      <div className="rounded-[24px] border border-slate-200 bg-white p-4">
        <div className="mb-4 grid grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-[12px]" />
          ))}
        </div>
      </div>
    </div>
  );
}

function QuotaPageSkeleton() {
  return (
    <div className="space-y-6 p-4 md:space-y-8 md:p-6" dir="rtl">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-30 rounded-[18px]" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-[24px] lg:col-span-2" />
        <div className="rounded-[24px] border border-slate-200 bg-white p-4">
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-[12px]" />
            ))}
          </div>
        </div>
      </div>

      <Skeleton className="h-28 rounded-[24px]" />
    </div>
  );
}

export { Skeleton, AiPlanPageSkeleton, HistoryPageSkeleton, QuotaPageSkeleton };