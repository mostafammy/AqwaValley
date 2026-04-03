"use client";

import { motion } from "framer-motion";
import { AlertCircle, TrendingDown, TrendingUp, Minus } from "lucide-react";
import type {
  QuotaState,
  TrendDirection,
} from "~/server/services/quotaDecisionService";

type QuotaBarCardProps = {
  consumptionM3: number;
  quotaM3: number;
  utilizationPct: number;
  effectiveState: QuotaState;
  trendDirection: TrendDirection;
  trendDeltaPct: number | null;
};

export function QuotaBarCard({
  consumptionM3,
  quotaM3,
  utilizationPct,
  effectiveState,
  trendDirection,
  trendDeltaPct,
}: QuotaBarCardProps) {
  const isDanger =
    effectiveState === "critical" || effectiveState === "exceeded";
  const isWarning = effectiveState === "warning";

  const barColorClass = isDanger
    ? "bg-red-500"
    : isWarning
      ? "bg-orange-400"
      : "bg-blue-500";

  const barTrackClass = "bg-slate-100";

  const clampedPct = Math.min(100, Math.max(0, utilizationPct));

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.3 }}
      className="group relative mb-4 flex flex-col overflow-hidden rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-lg md:mb-8 md:p-6"
    >
      {/* Background soft glow based on state */}
      <div
        className={`pointer-events-none absolute -top-20 -right-20 z-0 h-40 w-40 rounded-full opacity-20 mix-blend-multiply blur-3xl transition-opacity duration-500 ${
          isDanger ? "bg-red-400" : isWarning ? "bg-orange-400" : "bg-blue-400"
        }`}
      />

      <div className="relative z-10 mb-5 flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center">
        <div className="flex items-center gap-3 text-lg font-extrabold tracking-tight text-slate-800">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ring-black/5 transition-transform duration-300 group-hover:scale-110 ${
              isDanger
                ? "bg-red-50 text-red-500"
                : isWarning
                  ? "bg-orange-50 text-orange-500"
                  : "bg-blue-50 text-blue-500"
            }`}
          >
            <AlertCircle className="h-5 w-5" strokeWidth={2.5} />
          </div>
          موقف الحصة المائية (الشهر الحالي)
        </div>
        {trendDeltaPct !== null && (
          <div
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold shadow-sm ring-1 ring-black/5 ${
              trendDirection === "increase"
                ? "bg-red-50 text-red-600"
                : trendDirection === "decrease"
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-slate-50 text-slate-600"
            }`}
          >
            {trendDirection === "increase" ? (
              <TrendingUp className="h-4 w-4" strokeWidth={2.5} />
            ) : trendDirection === "decrease" ? (
              <TrendingDown className="h-4 w-4" strokeWidth={2.5} />
            ) : (
              <Minus className="h-4 w-4" strokeWidth={2.5} />
            )}
            <span dir="ltr" className="tracking-tight">
              {Math.abs(trendDeltaPct)}%
            </span>
            <span className="text-xs">مقارنة بالشهر الماضي</span>
          </div>
        )}
      </div>
      <div className="relative z-10 flex-1">
        <div className="mb-3 flex items-end justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-extrabold tracking-tight text-slate-900">
              {Math.round(consumptionM3).toLocaleString("ar-EG")}
            </span>
            <span className="text-sm font-bold text-slate-500">م³</span>
          </div>
          <div className="text-sm font-bold text-slate-500">
            الحد الأقصى:{" "}
            <span className="text-slate-700">
              {Math.round(quotaM3).toLocaleString("ar-EG")}
            </span>{" "}
            م³
          </div>
        </div>

        {/* Progress Bar Container */}
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={clampedPct}
          aria-valuetext={`${clampedPct}% used`}
          className={`relative h-4 overflow-hidden rounded-full ring-1 ring-black/5 ring-inset ${barTrackClass}`}
        >
          {/* Progress Fill */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${clampedPct}%` }}
            transition={{ duration: 1, type: "spring", bounce: 0.2 }}
            className={`h-full rounded-full ${barColorClass}`}
          />
        </div>

        <div className="mt-3 flex justify-between text-xs font-bold text-slate-400">
          <span>0%</span>
          <span
            className={`text-sm ${isDanger ? "text-red-500" : isWarning ? "text-orange-500" : "text-blue-500"}`}
          >
            {utilizationPct.toFixed(1)}% مستهلك
          </span>
          <span>100%</span>
        </div>
      </div>
    </motion.div>
  );
}
