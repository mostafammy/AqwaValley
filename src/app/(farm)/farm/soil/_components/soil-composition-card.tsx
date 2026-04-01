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
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in-pop">
      <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-base font-semibold text-navy">مكونات التربة</h3>
        <Info 
          className="w-5 h-5 text-slate-400" 
          aria-label="معلومات عن مكونات التربة"
          role="img"
        />
      </div>
      <div className="p-8">
        <div className="grid grid-cols-3 gap-4">
          {compositions.map((comp) => (
            <div 
              key={comp.label} 
              className="text-center p-5 bg-slate-50 rounded-2xl border border-slate-100"
            >
              <div className="text-xs font-medium text-slate-500 mb-2">{comp.label}</div>
              <div className={`${comp.color} text-3xl font-semibold`}>
                {comp.value}%
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-5 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-600 leading-relaxed">
          النسب أعلاه تمثل التحليل الفيزيائي لطبقات التربة. تساعد هذه البيانات النظام في حساب معامل نفاذية المياه.
        </div>
      </div>
    </div>
  );
}