"use client";

import { AlertCircle, TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { QuotaState, TrendDirection } from "~/server/services/quotaDecisionService";

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
  const isDanger = effectiveState === "critical" || effectiveState === "exceeded";
  const isWarning = effectiveState === "warning";
  
  const barColor = isDanger
    ? "var(--color-danger)"
    : isWarning
      ? "var(--color-warn)"
      : "var(--color-blue)";

  const clampedPct = Math.min(100, Math.max(0, utilizationPct));

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-5 mb-4 md:mb-8 flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 border-b border-gray-100 pb-3 gap-2">
        <div className="flex items-center gap-2 text-base font-bold text-gray-800">
          <AlertCircle className="w-5 h-5 text-blue-500" />
          موقف الحصة المائية (الشهر الحالي)
        </div>
        {trendDeltaPct !== null && (
          <div
            className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded bg-gray-50"
            style={{
              color:
                trendDirection === "increase"
                  ? "var(--color-danger)"
                  : trendDirection === "decrease"
                    ? "var(--color-ok)"
                    : "var(--color-muted)",
            }}
          >
            {trendDirection === "increase" ? (
              <TrendingUp className="w-3 h-3" />
            ) : trendDirection === "decrease" ? (
              <TrendingDown className="w-3 h-3" />
            ) : (
              <Minus className="w-3 h-3" />
            )}
            <span dir="ltr">{Math.abs(trendDeltaPct)}%</span>
            <span className="mr-1">مقارنة بالشهر الماضي</span>
          </div>
        )}
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-end mb-2">
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--color-navy)" }}>
            {Math.round(consumptionM3).toLocaleString("ar-EG")} <span style={{ fontSize: 13, color: "var(--color-muted)", fontWeight: 600 }}>م³</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--color-muted)", fontWeight: 600 }}>
            الحد الأقصى: {Math.round(quotaM3).toLocaleString("ar-EG")} م³
          </div>
        </div>

        {/* Progress Bar Container */}
        <div
          style={{
            height: 12,
            backgroundColor: "var(--color-bg-2)",
            borderRadius: 999,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Progress Fill */}
          <div
            style={{
              height: "100%",
              width: `${clampedPct}%`,
              backgroundColor: barColor,
              borderRadius: 999,
              transition: "width 0.5s ease-in-out, background-color 0.3s ease",
            }}
          />
          {/* 100% Marker Line if exceeded, though it clips. We can just let it fill 100% */}
        </div>
        
        <div className="flex justify-between mt-2 text-xs" style={{ color: "var(--color-muted)" }}>
          <span>0%</span>
          <span style={{ color: isDanger ? "var(--color-danger)" : "inherit", fontWeight: isDanger ? 700 : 400 }}>
            {utilizationPct.toFixed(1)}% مستهلك
          </span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}
