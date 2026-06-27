"use client";

import { useMemo } from "react";
import { api } from "~/trpc/react";
import type { QuotaState } from "~/server/services/quotaDecisionService";
import {
  KpiCardGrid,
  AnimatedNumber,
  type KpiCardProps,
} from "~/app/_components/UI/KpiCardGrid";

type FarmKpiCardsProps = {
  farmId: string;
  initialDailyConsumptionM3: number;
  initialDailyState: QuotaState;
  monthlyUtilizationPct: number;
  monthlyState: QuotaState;
  avgSoilHumidity: number | null;
  soilReadingCount: number;
};

function dailyStateBadge(state: QuotaState): { className: string; label: string } {
  if (state === "critical" || state === "exceeded")
    return { className: "badge-danger", label: "مفرط" };
  if (state === "warning") return { className: "badge-warn", label: "تحذير" };
  return { className: "badge-ok", label: "طبيعي" };
}

function monthlyStateBadge(state: QuotaState): {
  className: string;
  label: string;
} {
  if (state === "critical" || state === "exceeded")
    return { className: "badge-danger", label: "تجاوز الحصة" };
  if (state === "warning")
    return { className: "badge-warn", label: "قريب من الحد" };
  return { className: "badge-ok", label: "ضمن المعدل" };
}

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
    },
  );

  // Fetch current weather
  const { data: weather } = api.weather.getCurrent.useQuery(
    { farmId },
    {
      refetchInterval: 900000, // 15 mins (matching server cache)
    },
  );

  const dailyM3 = dailyStatus?.consumptionM3 ?? initialDailyConsumptionM3;
  const dailyState = dailyStatus?.effectiveState ?? initialDailyState;
  const dailyBadge = dailyStateBadge(dailyState);
  const monthlyBadge = monthlyStateBadge(monthlyState);

  const cards: KpiCardProps[] = useMemo(() => [
    {
      id: "daily-consumption",
      label: "الاستهلاك اليومي",
      value: (
        <>
          <AnimatedNumber value={dailyM3} decimals={1} />{" "}
          <span className="text-sm font-semibold text-gray-400">م³</span>
        </>
      ),
      icon: "droplets",
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
        <span className={`badge ${dailyBadge.className}`}>
          <span className="badge-dot" />
          {dailyBadge.label}
        </span>
      ),
    },
    {
      id: "monthly-consumption",
      label: "استهلاك الحصة الشهرية",
      value: (
        <>
          <AnimatedNumber value={monthlyUtilizationPct} decimals={1} />{" "}
          <span className="text-sm font-semibold text-gray-400">%</span>
        </>
      ),
      icon: "activity",
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
        <span className={`badge ${monthlyBadge.className}`}>
          <span className="badge-dot" />
          {monthlyBadge.label}
        </span>
      ),
    },
    {
      id: "soil-humidity",
      label: "متوسط رطوبة التربة",
      value:
        avgSoilHumidity !== null ? (
          <>
            <AnimatedNumber value={avgSoilHumidity} />{" "}
            <span className="text-sm font-semibold text-gray-400">%</span>
          </>
        ) : (
          <span className="text-lg text-gray-400">---</span>
        ),
      icon: "percent",
      border: "border-r-teal-500",
      iconBg: "bg-teal-50",
      iconColor: "text-teal-500",
      extra: (
        <div className="mt-1 text-xs" style={{ color: "black" }}>
          من {soilReadingCount} آبار نشطة
        </div>
      ),
    },
    {
      id: "weather",
      label: "حالة الطقس",
      value: weather ? (
        <>
          <AnimatedNumber value={weather.temp} />°{" "}
          <span className="text-sm font-semibold text-gray-400">م</span>
        </>
      ) : (
        <span className="text-lg text-gray-400">---</span>
      ),
      icon: "cloudSun",
      border: "border-r-sky-500",
      iconBg: "bg-sky-50",
      iconColor: "text-sky-500",
      extra: (
        <div
          className="mt-1 truncate text-xs font-medium"
          style={{ color: "black" }}
        >
          {weather?.description ?? "جاري التحميل..."}{" "}
          {weather ? `| رطوبة ${weather.humidity}%` : ""}
        </div>
      ),
    },
  ], [dailyM3, dailyState, dailyBadge.className, dailyBadge.label, monthlyUtilizationPct, monthlyState, monthlyBadge.className, monthlyBadge.label, avgSoilHumidity, soilReadingCount, weather]);

  // The dashboard shows 4 key metric cards: daily, monthly, humidity, and weather.
  // Wrap it in a div that gives some bottom margin
  return (
    <div className="mb-v">
      <KpiCardGrid cards={cards} />
    </div>
  );
}
