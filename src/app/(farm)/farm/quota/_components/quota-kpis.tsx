"use client";

import { Droplets, Activity, CheckCircle } from "lucide-react";
import { KpiCardGrid, type KpiCardProps } from "~/app/_components/UI/KpiCardGrid";

type QuotaKpisProps = {
  monthlyLimit: number;
  usedLitres: number;
  remainingLitres: number;
  utilizationPct: number;
  state: string;
};

export function QuotaKpis({
  monthlyLimit,
  usedLitres,
  remainingLitres,
  utilizationPct,
  state,
}: QuotaKpisProps) {
  const cards: KpiCardProps[] = [
    {
      label: "الحصة الشهرية",
      value: (
        <>
          {(monthlyLimit / 1000).toLocaleString("ar-EG")} <span className="text-sm text-gray-400 font-semibold">م³</span>
        </>
      ),
      icon: Droplets,
      border: "border-r-blue-500",
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
      extra: (
        <div className="text-xs mt-1 text-gray-400">
          المخصصة لهذا الشهر
        </div>
      ),
    },
    {
      label: "المستهلك هذا الشهر",
      value: (
        <>
          {(usedLitres / 1000).toLocaleString("ar-EG")} <span className="text-sm text-gray-400 font-semibold">م³</span>
        </>
      ),
      icon: Activity,
      border:
        state === "critical" || state === "exceeded"
          ? "border-r-red-500"
          : state === "warning"
            ? "border-r-amber-500"
            : "border-r-blue-500",
      iconBg:
        state === "critical" || state === "exceeded"
          ? "bg-red-50"
          : state === "warning"
            ? "bg-amber-50"
            : "bg-blue-50",
      iconColor:
        state === "critical" || state === "exceeded"
          ? "text-red-500"
          : state === "warning"
            ? "text-amber-500"
            : "text-blue-500",
      extra: (
        <span
          className={`badge ${
            state === "critical" || state === "exceeded"
              ? "badge-danger"
              : state === "warning"
                ? "badge-warn"
                : "badge-ok"
          } mt-1`}
        >
          <span className="badge-dot" />
          {utilizationPct.toFixed(1)}% مستهلك
        </span>
      ),
    },
    {
      label: "المتبقي من الحصة",
      value: (
        <>
          {(remainingLitres / 1000).toLocaleString("ar-EG")} <span className="text-sm text-gray-400 font-semibold">م³</span>
        </>
      ),
      icon: CheckCircle,
      border: "border-r-teal-500",
      iconBg: "bg-teal-50",
      iconColor: "text-teal-500",
      extra: (
        <div className="text-xs mt-1 text-emerald-600 font-medium">
          {state === "exceeded" ? "تجاوزت الحصة" : "رصيد متاح للاستخدام"}
        </div>
      ),
    },
  ];

  return <KpiCardGrid cards={cards} />;
}
