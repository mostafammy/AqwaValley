/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/no-unsafe-argument */
"use client";

import { useId } from "react";
import { BarChart as BarChartIcon } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useIntersectionObserver } from "~/lib/hooks";
import { Card, CardBody, CardHeader } from "~/app/_components/UI/Card";

type QuotaTrendItem = {
  periodStart: string | Date;
  quotaM3: string | number;
  consumptionM3: string | number;
  effectiveState: string;
};

type HistoryChartProps = {
  data: QuotaTrendItem[];
};

export function HistoryChart({ data }: HistoryChartProps) {
  const { targetRef, isVisible } = useIntersectionObserver();
  const gradientId = useId();

  const chartData = data.map((item) => {
    const consumption = Number(item.consumptionM3);
    const dateObj = new Date(item.periodStart);
    const isValidDate = Number.isFinite(dateObj.getTime());

    return {
      name: isValidDate
        ? dateObj.toLocaleDateString("ar-EG", {
            month: "short",
            year: "2-digit",
          })
        : "—",
      consumption: Number.isFinite(consumption) ? consumption : 0,
    };
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <BarChartIcon className="h-5 w-5 text-blue-500 shrink-0" />
          <span className="text-base font-semibold text-gray-800">
            ملخص الاستهلاك الشهري (آخر 6 أشهر)
          </span>
        </div>
      </CardHeader>
      <CardBody className="pt-3 -mx-6 md:mx-0">
        <div ref={targetRef} className="h-48 sm:h-64 md:h-80">
          {chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              لا تتوافر بيانات استهلاك حالياً
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={isVisible ? chartData : []}
                margin={{ top: 10, right: 10, left: -20, bottom: 10 }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1D6FA8" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#1D6FA8" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="rgba(26,48,80,0.06)"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#8AA0B8" }}
                  dy={12}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#8AA0B8" }}
                  tickFormatter={(value: number) => `${Math.round(value).toLocaleString("ar-EG")}`}
                  width={50}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid rgba(26,48,80,0.12)",
                    borderRadius: "10px",
                    fontSize: "13px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                  }}
                  formatter={(value: any) => [`${Number(value).toLocaleString("ar-EG")} م³`, "الاستهلاك"]}
                  labelStyle={{ color: "#5A7090" }}
                />
                <Area
                  type="monotone"
                  dataKey="consumption"
                  stroke="#1D6FA8"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill={`url(#${gradientId})`}
                  isAnimationActive={isVisible}
                  animationDuration={1000}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardBody>
    </Card>
  );
}