"use client";

import { Droplets, Activity, Percent } from "lucide-react";
import { api } from "~/trpc/react";
import type { QuotaState } from "~/server/services/quotaDecisionService";
import { KpiCardGrid, type KpiCardProps } from "~/app/_components/UI/KpiCardGrid";

type FarmKpiCardsProps = {
  farmId: string;
  initialDailyConsumptionM3: number;
  initialDailyState: QuotaState;
  monthlyUtilizationPct: number;
  monthlyState: QuotaState;
  avgSoilHumidity: number | null;
  soilReadingCount: number;
};

export function KpiCards({
  farmId,
  initialDailyConsumptionM3,
  initialDailyState,
  monthlyUtilizationPct,
  monthlyState,
  avgSoilHumidity,
  soilReadingCount,
}: FarmKpiCardsProps) {
  // 60s live polling for daily quota status
  const { data: dailyStatus } = api.quotas.farmStatus.useQuery(
    { farmId, periodType: "daily" },
    {
      refetchInterval: 60000,
      initialData: undefined,
    }
  );

  const dailyM3 = dailyStatus?.consumptionM3 ?? initialDailyConsumptionM3;
  const dailyState = dailyStatus?.effectiveState ?? initialDailyState;

  const cards: KpiCardProps[] = [
    {
      label: "الاستهلاك اليومي",
      value: (
        <>
          {dailyM3.toFixed(1)} <span className="text-sm text-gray-400 font-semibold">م³</span>
        </>
      ),
      icon: Droplets,
      border:
        dailyState === "critical" || dailyState === "exceeded"
          ? "border-r-red-500"
          : dailyState === "warning"
            ? "border-r-amber-500"
            : "border-r-blue-500",
      iconBg:
        dailyState === "critical" || dailyState === "exceeded"
          ? "bg-red-50"
          : dailyState === "warning"
            ? "bg-amber-50"
            : "bg-blue-50",
      iconColor:
        dailyState === "critical" || dailyState === "exceeded"
          ? "text-red-500"
          : dailyState === "warning"
            ? "text-amber-500"
            : "text-blue-500",
      extra: (
        <span
          className={`badge ${
            dailyState === "critical" || dailyState === "exceeded"
              ? "badge-danger"
              : dailyState === "warning"
                ? "badge-warn"
                : "badge-ok"
          }`}
        >
          <span className="badge-dot" />
          {dailyState === "ok" ? "طبيعي" : dailyState === "warning" ? "تحذير" : "مفرط"}
        </span>
      ),
    },
    {
      label: "استهلاك الحصة الشهرية",
      value: (
        <>
          {monthlyUtilizationPct.toFixed(1)} <span className="text-sm text-gray-400 font-semibold">%</span>
        </>
      ),
      icon: Activity,
      border:
        monthlyState === "critical" || monthlyState === "exceeded"
          ? "border-r-red-500"
          : monthlyState === "warning"
            ? "border-r-amber-500"
            : "border-r-teal-500",
      iconBg:
        monthlyState === "critical" || monthlyState === "exceeded"
          ? "bg-red-50"
          : monthlyState === "warning"
            ? "bg-amber-50"
            : "bg-teal-50",
      iconColor:
        monthlyState === "critical" || monthlyState === "exceeded"
          ? "text-red-500"
          : monthlyState === "warning"
            ? "text-amber-500"
            : "text-teal-500",
      extra: (
        <span
          className={`badge ${
            monthlyState === "critical" || monthlyState === "exceeded"
              ? "badge-danger"
              : monthlyState === "warning"
                ? "badge-warn"
                : "badge-ok"
          }`}
        >
          <span className="badge-dot" />
          {monthlyState === "ok" ? "ضمن المعدل" : monthlyState === "warning" ? "قريب من الحد" : "تجاوز الحصة"}
        </span>
      ),
    },
    {
      label: "متوسط رطوبة التربة",
      value: avgSoilHumidity !== null ? (
        <>
          {avgSoilHumidity} <span className="text-sm text-gray-400 font-semibold">%</span>
        </>
      ) : (
        <span className="text-gray-400 text-lg">---</span>
      ),
      icon: Percent,
      border: "border-r-teal-500",
      iconBg: "bg-teal-50",
      iconColor: "text-teal-500",
      extra: (
        <div className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
          من {soilReadingCount} آبار نشطة
        </div>
      ),
    },
  ];

  // Notice we only have 3 cards for the Farm, but KpiCardGrid uses a configurable map.
  // Wrap it in a div that gives some bottom margin
  return (
    <div className="mb-v">
      <KpiCardGrid cards={cards} />
    </div>
  );
}
