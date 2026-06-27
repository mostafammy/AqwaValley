"use client";

import { Info } from "lucide-react";

interface SoilCompositionProps {
  clay: number;
  sand: number;
  silt: number;
}

export function SoilCompositionCard({ clay, sand, silt }: SoilCompositionProps) {
  const compositions = [
    { label: "الطين", value: clay, color: "text-amber-700" },
    { label: "الرمل", value: sand, color: "text-orange-900" },
    { label: "الطمي", value: silt, color: "text-stone-600" },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm animate-fade-in-pop sm:rounded-3xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-8 sm:py-5">
        <h3 className="text-sm font-semibold text-navy sm:text-base">مكونات التربة</h3>
        <Info
          className="h-5 w-5 shrink-0 text-slate-400"
          aria-hidden="true"
        />
      </div>
      <div className="p-4 sm:p-6 md:p-8">
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {compositions.map((comp) => (
            <div
              key={comp.label}
              className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-center sm:p-5"
            >
              <div className="mb-1 text-[10px] font-medium text-slate-500 sm:mb-2 sm:text-xs">
                {comp.label}
              </div>
              <div className={`${comp.color} text-xl font-semibold tabular-nums sm:text-3xl`}>
                {comp.value}%
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-[11px] font-semibold leading-relaxed text-amber-700 sm:mt-8 sm:p-5 sm:text-xs">
          ملاحظة: البيانات المعروضة أعلاه استرشادية. جاري العمل على ربط بيانات تحليل التربة الحقيقية بقاعدة البيانات.
        </div>
      </div>
    </div>
  );
}