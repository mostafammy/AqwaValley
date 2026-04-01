"use client";

import { Calendar, Droplets, ArrowLeft, History, CheckCircle, ChevronRight, ChevronLeft } from "lucide-react";
import { api } from "~/trpc/react";
import { useRef } from "react";
import { Card, CardBody } from "~/app/_components/UI/Card";

interface IrrigationPlanObject {
  reasoning: string;
  zones: Array<{
    zoneId: string;
    cropType: string;
    scheduledAt: string;
    recommendedLitres: number;
  }>;
}

interface PlanHistorySectionProps {
  farmId: string;
  onActivate: (planId: string) => void;
}

export function PlanHistorySection({ farmId, onActivate }: PlanHistorySectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: plans, isLoading } = api.irrigation.listPlans.useQuery(
    { farmId, limit: 12 }
  );

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === "left" ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: "smooth" });
    }
  };

  if (plans?.length === 0 && !isLoading) return null;

  return (
    <div className="pt-12 border-t border-gray-100" id="history-section">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black text-navy flex items-center gap-3">
            <History className="w-6 h-6 text-blue-500" />
            سجل التوصيات السابقة
          </h2>
          <p className="text-sm text-gray-400 mt-1 font-medium">مراجعة والاعتماد السريع للخطط السابقة</p>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => scroll("right")}
            className="p-2 rounded-xl bg-white border border-gray-200 hover:bg-white-light text-muted transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button 
            onClick={() => scroll("left")}
            className="p-2 rounded-xl bg-white border border-gray-200 hover:bg-white-light text-muted transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex gap-6 overflow-x-auto pb-8 snap-x snap-mandatory no-scrollbar scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="min-w-[320px] h-64 bg-gray-100 animate-pulse rounded-3xl" />
          ))
        ) : (
          plans?.map((plan) => {
            const planData = plan.plan as IrrigationPlanObject;
            const isActivated = plan.status === "ACTIVATED";

            return (
              <Card 
                key={plan.id}
                accent={isActivated ? "teal" : undefined}
                className={`min-w-[320px] md:min-w-95 snap-start border ${
                  isActivated ? "ring-4 ring-teal/5 shadow-ok/5" : "border-gray-100"
                } group cursor-default h-full flex flex-col`}
              >
                <CardBody className="p-6 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                     <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-blue" />
                        {new Intl.DateTimeFormat("ar-EG", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }).format(new Date(plan.createdAt))}
                     </div>
                     <span className={`badge ${isActivated ? "badge-ok" : "badge-gray"}`}>
                        {isActivated ? <CheckCircle className="w-3 h-3 mr-1" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-1" />}
                        {isActivated ? "مُفعَّلة" : "مسودة"}
                     </span>
                  </div>

                  <div className="flex-1">
                    <div className="text-sm text-slate-600 line-clamp-3 leading-relaxed mb-6 font-medium italic opacity-80 group-hover:opacity-100 transition-opacity">
                      «{planData.reasoning}»
                    </div>
                  </div>

                  <div className="flex items-end justify-between border-t border-gray-50 pt-5 mt-auto">
                     <div className="space-y-1">
                        <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1 uppercase">
                           <Droplets className="w-3 h-3" /> الكمية
                        </div>
                        <div className="text-xl font-black text-navy flex items-baseline gap-1">
                          {(plan.totalLitres / 1000).toFixed(1)}
                          <span className="text-[10px] font-medium text-slate-400">م³</span>
                        </div>
                     </div>

                     {!isActivated ? (
                       <button 
                         onClick={() => onActivate(plan.id)}
                         className="btn btn-ghost bg-blue-light text-blue text-[11px] px-4 py-2 rounded-xl transition-all shadow-sm gap-2"
                       >
                          تطبيق الآن
                          <ArrowLeft className="w-3.5 h-3.5" />
                       </button>
                     ) : (
                       <div className="flex items-center gap-1.5 text-teal text-[11px] font-bold bg-teal-light/30 px-3.5 py-2 rounded-xl border border-teal/10">
                          <CheckCircle className="w-4 h-4" />
                          الخطة الحالية
                       </div>
                     )}
                  </div>
                </CardBody>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
