"use client";

import { BarChart as BarChartIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useIntersectionObserver } from "~/lib/hooks";

type QuotaTrendItem = {
  periodStart: string | Date;
  quotaM3: string | number;
  consumptionM3: string | number;
  effectiveState: string;
};

type QuotaUsageChartProps = {
  trend: QuotaTrendItem[];
};

export function QuotaUsageChart({ trend }: QuotaUsageChartProps) {
  const { targetRef, isVisible } = useIntersectionObserver();

  const data = trend.map((item) => {
    const consumption = Number(item.consumptionM3);
    const quota = Number(item.quotaM3);
    const dateObj = new Date(item.periodStart);

    return {
      name: dateObj.toLocaleDateString("ar-EG", { month: "short" }),
      consumption: Number.isFinite(consumption) ? consumption : 0,
      quota: Number.isFinite(quota) ? quota : 0,
      state: item.effectiveState,
    };
  });

  // Calculate max values to determine scaling
  const maxConsumption = Math.max(...data.map(d => d.consumption), 0);
  const maxQuota = Math.max(...data.map(d => d.quota), 0);
  
  // If quota is significantly higher (> 2.5x), we scale primarily to consumption
  // to prevent the bars from looking tiny.
  const isQuotaExtreme = maxQuota > maxConsumption * 2.5;
  const yDomain = (isQuotaExtreme ? [0, Math.ceil(maxConsumption * 1.3)] : [0, "auto"]) as [number, number | "auto"];

  return (
    <div
      className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-5"
      ref={targetRef}
    >
      <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2 text-base font-bold text-gray-800">
          <BarChartIcon className="h-5 w-5 text-blue-500" />
          استهلاك الأشهر الماضية (م³)
        </div>
        {isQuotaExtreme && (
          <div className="badge badge-warn text-[10px] py-1 px-2">
            الحصة القصوى: {maxQuota.toLocaleString("ar-EG")} م³
          </div>
        )}
      </div>
      <div className="flex-1" style={{ width: "100%", minHeight: 450 }}>
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            لا تتوافر بيانات استهلاك
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={isVisible ? data : []}
              margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
              barCategoryGap="20%"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="rgba(26,48,80,0.05)"
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: "#8AA0B8", fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                dy={10}
              />
              <YAxis
                domain={yDomain}
                tick={{ fontSize: 11, fill: "#8AA0B8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => Math.round(val).toLocaleString("ar-EG")}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid rgba(26,48,80,0.1)",
                  fontSize: "13px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
                  textAlign: "right",
                  direction: "rtl"
                }}
                itemStyle={{ padding: '2px 0' }}
                cursor={{ fill: 'rgba(26,48,80,0.02)' }}
              />
              
              <Bar 
                dataKey="consumption" 
                name="الاستهلاك الفعلي"
                radius={[6, 6, 0, 0]}
                barSize={48}
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.consumption > entry.quota ? "#EF4444" : "#1D6FA8"} 
                    opacity={0.85}
                  />
                ))}
              </Bar>
              
              {!isQuotaExtreme && (
                <Line 
                  type="stepAfter" 
                  dataKey="quota" 
                  name="الحصة المخصصة" 
                  stroke="#D97706" 
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="mt-4 flex items-center justify-end gap-6 text-xs text-gray-400">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-blue-600" />
          <span>الاستهلاك الطبيعي</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <span>تجاوز الحصة</span>
        </div>
        {!isQuotaExtreme && (
          <div className="flex items-center gap-1.5">
            <div className="h-[2px] w-4 border-t-2 border-dashed border-amber-600" />
            <span>خط الحصة</span>
          </div>
        )}
      </div>
    </div>
  );
}
