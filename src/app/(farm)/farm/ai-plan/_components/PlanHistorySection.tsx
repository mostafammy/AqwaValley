"use client";

import {
  Calendar,
  Droplets,
  ArrowLeft,
  History,
  CheckCircle,
} from "lucide-react";
import { api } from "~/trpc/react";
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
  const { data: plans, isLoading } = api.irrigation.listPlans.useQuery({
    farmId,
    limit: 12,
  });

  if (plans?.length === 0 && !isLoading) return null;

  const currentPlanId = plans?.find((p) => p.status === "ACTIVATED")?.id;

  return (
    <div className="w-full max-w-full" id="history-section">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="flex flex-col items-start">
          <h2 className="text-navy flex items-center gap-3 text-2xl font-black">
            <History className="h-6 w-6 text-blue-500" />
            سجل التوصيات السابقة
          </h2>
          <p className="mt-1 text-sm font-medium text-gray-400">
            مراجعة والاعتماد السريع للخطط السابقة
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-28 w-full animate-pulse rounded-3xl bg-gray-100"
              />
            ))
          : plans?.map((plan) => {
              const planData = (plan.plan as IrrigationPlanObject) || {
                reasoning: "بدون تفاصيل",
                zones: [],
              };
              const isActivated = plan.status === "ACTIVATED";
              const isCurrentPlan = plan.id === currentPlanId;

              return (
                <Card
                  key={plan.id}
                  accent={isActivated ? "teal" : undefined}
                  className={`w-full border transition-shadow hover:shadow-md ${
                    isActivated
                      ? "ring-teal/5 shadow-ok/5 ring-4"
                      : "border-gray-100"
                  } group flex cursor-default flex-row`}
                >
                  <CardBody className="flex w-full flex-row items-center gap-4 p-4 md:p-6">
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50">
                        <Calendar className="text-blue h-5 w-5" />
                      </div>
                      <div className="hidden flex-col sm:flex">
                        <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                          التاريخ
                        </span>
                        <span className="text-navy text-sm font-bold">
                          {new Intl.DateTimeFormat("ar-EG", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }).format(new Date(plan.createdAt))}
                        </span>
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-sm leading-relaxed font-medium text-slate-600 italic opacity-90 transition-opacity group-hover:opacity-100">
                        &quot;{planData.reasoning}&quot;
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <div className="hidden flex-col items-end sm:flex">
                        <div className="flex items-center gap-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                          <Droplets className="h-3 w-3" /> الكمية
                        </div>
                        <div className="text-navy flex items-baseline gap-1 text-lg font-black tabular-nums">
                          {(plan.totalLitres / 1000).toFixed(1)}
                          <span className="text-[10px] font-medium text-slate-400">
                            م³
                          </span>
                        </div>
                      </div>

                      <span
                        className={`badge ${isActivated ? "badge-ok" : "badge-gray"} shrink-0`}
                      >
                        {isActivated ? (
                          <CheckCircle className="mr-1 h-3 w-3" />
                        ) : (
                          <span className="mr-1 h-1.5 w-1.5 rounded-full bg-slate-300" />
                        )}
                        {isActivated ? "مُفعَّلة" : "مسودة"}
                      </span>

                      {!isCurrentPlan && (
                        <motion.button
                          whileTap={tapFeedback}
                          onClick={() => onActivate(plan.id)}
                          className="btn btn-ghost bg-blue-light text-blue shrink-0 gap-2 rounded-xl px-4 py-2 text-[11px] shadow-sm transition-all"
                        >
                          تطبيق الآن
                          <ArrowLeft className="h-3.5 w-3.5" />
                        </motion.button>
                      )}

                      {isCurrentPlan && (
                        <div className="text-teal bg-teal-light/30 border-teal/10 hidden shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[11px] font-bold md:flex">
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
  );
}