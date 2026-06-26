"use client";

import {
  Calendar,
  Droplets,
  ArrowLeft,
  History,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { api } from "~/trpc/react";
import { useRef } from "react";
import { motion } from "framer-motion";
import { Card, CardBody } from "~/app/_components/UI/Card";
import { tapFeedback } from "~/lib/motion";

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

export function PlanHistorySection({
  farmId,
  onActivate,
}: PlanHistorySectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: plans, isLoading } = api.irrigation.listPlans.useQuery({
    farmId,
    limit: 12,
  });

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo =
        direction === "left"
          ? scrollLeft - clientWidth
          : scrollLeft + clientWidth;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: "smooth" });
    }
  };

  if (plans?.length === 0 && !isLoading) return null;

  return (<>
  <div className="w-full max-w-full overflow-hidden">
    <div className=" mb-8 grid grid-cols-2  ">

        <div className="flex items-start flex-col w-full ">

          <h2 className="text-navy flex items-center gap-3 text-2xl font-black">
            <History className="h-6 w-6 text-blue-500" />
            سجل التوصيات السابقة
          </h2>
          <p className="mt-1 text-sm font-medium text-gray-400">
            مراجعة والاعتماد السريع للخطط السابقة
          </p>

        </div>

        <div className="flex justify-end gap-2">

          <motion.button
            whileTap={tapFeedback}
            onClick={() => scroll("right")}
            aria-label="التحريك لليمين"
            className="hover:bg-white-light text-black rounded-xl border border-gray-200 bg-white p-2 transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </motion.button>

          <motion.button
            whileTap={tapFeedback}
            onClick={() => scroll("left")}
            aria-label="التحريك لليسار"
            className="hover:bg-white-light text-black rounded-xl border border-gray-200 bg-white p-2 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </motion.button>

        </div>
      </div>

<div className="border-t border-gray-100 pt-12 w-full max-w-full overflow-hidden" id="history-section">

      <div
        ref={scrollRef}
        className="no-scrollbar flex max-w-full snap-x snap-mandatory gap-6 overflow-x-auto overflow-y-hidden scroll-smooth pb-8"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-64 w-72 shrink-0 animate-pulse rounded-3xl bg-gray-100"
              />
            ))
          : plans?.map((plan) => {
              const planData = (plan.plan as IrrigationPlanObject) || {
                reasoning: "بدون تفاصيل",
                zones: [],
              };
              const isActivated = plan.status === "ACTIVATED";

              return (
                <Card
                  key={plan.id}
                  accent={isActivated ? "teal" : undefined}
                  className={`w-80 shrink-0 snap-start border md:w-95 ${
                    isActivated
                      ? "ring-teal/5 shadow-ok/5 ring-4"
                      : "border-gray-100"
                  } group flex h-full cursor-default flex-col`}
                >
                  <CardBody className="flex h-full flex-col p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                        <Calendar className="text-blue h-3.5 w-3.5" />
                        {new Intl.DateTimeFormat("ar-EG", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }).format(new Date(plan.createdAt))}
                      </div>
                      <span
                        className={`badge ${isActivated ? "badge-ok" : "badge-gray"}`}
                      >
                        {isActivated ? (
                          <CheckCircle className="mr-1 h-3 w-3" />
                        ) : (
                          <span className="mr-1 h-1.5 w-1.5 rounded-full bg-slate-300" />
                        )}
                        {isActivated ? "مُفعَّلة" : "مسودة"}
                      </span>
                    </div>

                    <div className="flex-1">
                      <div className="mb-6 line-clamp-3 text-sm leading-relaxed font-medium text-slate-600 italic opacity-80 transition-opacity group-hover:opacity-100">
                        &quot;{planData.reasoning}&quot;
                      </div>
                    </div>

                    <div className="mt-auto flex items-end justify-between border-t border-gray-50 pt-5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                          <Droplets className="h-3 w-3" /> الكمية
                        </div>
                        <div className="text-navy flex items-baseline gap-1 text-xl font-black">
                          {(plan.totalLitres / 1000).toFixed(1)}
                          <span className="text-[10px] font-medium text-slate-400">
                            م³
                          </span>
                        </div>
                      </div>

                      {!isActivated ? (
                        <motion.button
                          whileTap={tapFeedback}
                          onClick={() => onActivate(plan.id)}
                          className="btn btn-ghost bg-blue-light text-blue gap-2 rounded-xl px-4 py-2 text-[11px] shadow-sm transition-all"
                        >
                          تطبيق الآن
                          <ArrowLeft className="h-3.5 w-3.5" />
                        </motion.button>
                      ) : (
                        <div className="text-teal bg-teal-light/30 border-teal/10 flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[11px] font-bold">
                          <CheckCircle className="h-4 w-4" />
                          الخطة الحالية
                        </div>
                      )}
                    </div>
                  </CardBody>
                </Card>
              );
            })}
      </div>
    </div>
  </div>
    </>
  );
}
