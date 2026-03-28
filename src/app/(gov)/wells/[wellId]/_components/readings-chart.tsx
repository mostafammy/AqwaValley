"use client";

import { useState } from "react";
import { useIntersectionObserver } from "~/lib/hooks";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

type MetricRow = {
  bucket:    string;
  type:      string;
  avg_value: number;
};

type ApiResponse = {
  wellId: string;
  rows:   MetricRow[];
};

const RANGES = [
  { label: "يوم",      key: "1d",  range: "24",    bucket: "30"   },
  { label: "أسبوع",   key: "1w",  range: "168",   bucket: "60"   },
  { label: "شهر",     key: "1m",  range: "720",   bucket: "360"  },
  { label: "سنة",     key: "1y",  range: "8760",  bucket: "1440" },
] as const;

type RangeKey = typeof RANGES[number]["key"];

async function fetchMetrics(
  wellId: string,
  range:  string,
  bucket: string,
): Promise<MetricRow[]> {
  const res = await fetch(
    `/api/wells/${wellId}/metrics?range=${range}h&bucket=${bucket}m&format=json`,
  );
  if (!res.ok) throw new Error("Failed to fetch metrics");
  const data = (await res.json()) as ApiResponse;
  return data.rows.filter((r) => r.type === "water_level");
}

export function ReadingsChart({ wellId }: { wellId: string }) {
  const { targetRef, isVisible } = useIntersectionObserver();
  const [activeRange, setActiveRange] = useState<RangeKey>("1w");
  const cfg = RANGES.find((r) => r.key === activeRange)!;

  const { data, isLoading, isError } = useQuery({
    queryKey:        ["well-metrics", wellId, activeRange],
    queryFn:         () => fetchMetrics(wellId, cfg.range, cfg.bucket),
    refetchInterval: 30_000,
    staleTime:       20_000,
  });

  return (
    <div ref={targetRef} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      {/* Header + Tabs */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold"> قراءات منسوب المياه</h3>
          {isLoading && (
            <span className="text-xs text-gray-400 animate-pulse">
              جاري التحديث...
            </span>
          )}
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setActiveRange(r.key)}
              className={`
                px-3 py-1 rounded-md text-xs font-semibold transition-all
                ${activeRange === r.key
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
                }
              `}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* States */}
      {isError ? (
        <div className="h-48 flex items-center justify-center text-red-400 text-sm">
          فشل تحميل البيانات
        </div>
      ) : isLoading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : !data?.length ? (
        <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
          لا توجد بيانات لهذه الفترة
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={isVisible ? data : []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="levelGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#1D6FA8" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#1D6FA8" stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="bucket"
              tick={{ fontSize: 10, fontFamily: "Cairo" }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
              tickFormatter={(val: string) =>
                new Date(val).toLocaleDateString("ar-EG", {
                  month: "short",
                  day:   activeRange === "1y" ? undefined : "numeric",
                  hour:  activeRange === "1d" ? "2-digit" : undefined,
                })
              }            />
            <YAxis
              tick={{ fontSize: 11, fontFamily: "Cairo" }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={(v: number) => `${v.toFixed(1)}`}
            />
            <Tooltip
              contentStyle={{
                fontFamily:   "Cairo",
                borderRadius: "8px",
                border:       "1px solid #e5e7eb",
                fontSize:     "12px",
                direction:    "rtl",
              }}
              formatter={(value: unknown) => {
                if (typeof value === "number") {
                  return [`${value.toFixed(2)}`, "متوسط المنسوب"];
                }
                return ["", "متوسط المنسوب"];
              }}
              labelFormatter={(label: unknown) => {
                if (typeof label === "string") {
                  return new Date(label).toLocaleString("ar-EG");
                }
                return "";
              }}
            />
            <Area
              type="monotone"
              dataKey="avg_value"
              stroke="#1D6FA8"
              strokeWidth={2}
              fill="url(#levelGrad)"
              dot={false}
              activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }}
              isAnimationActive={isVisible}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* Live indicator */}
      <div className="flex items-center gap-1.5 mt-3 justify-end">
        <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
        <span className="text-xs text-gray-400">تحديث كل 30 ثانية</span>
      </div>
    </div>
  );
}