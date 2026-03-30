"use client";

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

type WeeklyTrendCardProps = {
  weeklyTrend: Array<{
    consumptionM3: number | string;
    periodStart: string | Date;
  }>;
};

export function WeeklyTrendCard({ weeklyTrend }: WeeklyTrendCardProps) {
  const { targetRef, isVisible } = useIntersectionObserver();

  // Format data for chart
  const data =
    weeklyTrend && weeklyTrend.length > 0
      ? weeklyTrend.map((item) => {
          const consumption = Number(item.consumptionM3);
          const dateObj = new Date(item.periodStart);
          const isValidDate = !isNaN(dateObj.getTime());

          return {
            date: isValidDate
              ? dateObj.toLocaleDateString("ar-EG", {
                  weekday: "short",
                  day: "numeric",
                })
              : "",
            value: Number.isFinite(consumption) ? consumption : 0,
          };
        })
      : [];

  return (
    <div
      className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-5"
      ref={targetRef}
    >
      <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2 text-base font-bold text-gray-800">
          <BarChartIcon className="h-5 w-5 text-blue-500" />
          استهلاك المياه آخر 7 أيام
        </div>
      </div>
      <div className="flex-1" style={{ width: "100%", minHeight: 260 }}>
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            لا تتوافر بيانات استهلاك
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={isVisible ? data : []}
              margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
            >
              <defs>
                <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1D6FA8" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#1D6FA8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="rgba(26,48,80,0.05)"
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#8AA0B8" }}
                axisLine={false}
                tickLine={false}
                dy={10}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#8AA0B8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val: number | string) => {
                  const numeric = Number(val);
                  return Number.isFinite(numeric)
                    ? Math.round(numeric).toLocaleString("ar-EG")
                    : "0";
                }}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "10px",
                  border: "1px solid rgba(26,48,80,0.1)",
                  fontSize: "12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                }}
                formatter={(value: number | string) => {
                  const numeric = Number(value);
                  const formatted = Number.isFinite(numeric)
                    ? numeric.toLocaleString("ar-EG")
                    : "0";
                  return [`${formatted} م³`, "الاستهلاك"];
                }}
                labelStyle={{ color: "#5A7090", marginBottom: 4 }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#1D6FA8"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorTrend)"
                isAnimationActive={isVisible}
                animationDuration={800}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
