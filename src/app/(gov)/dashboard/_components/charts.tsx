"use client";

import { useState, useEffect, useRef, useId } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export interface ConsumptionPoint {
  month:  string;
  actual: number;
  quota:  number;
}

export interface DistributionPoint {
  label: string;
  "القيمة (متر مكعب)": number;
}

interface DashboardChartsProps {
  consumptionData: ConsumptionPoint[];
  distributionData: DistributionPoint[];
}

export function DashboardCharts({ consumptionData, distributionData }: DashboardChartsProps) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const actualId = useId();
  const quotaId  = useId();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Only animate once
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="grid grid-cols-1 md:grid-cols-2 gap-4">

      {/* Line Chart — اتجاه الاستهلاك */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold mb-4 text-right">
          الاستهلاك الشهري للمياه
        </h3>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={isVisible ? consumptionData : []}>
            <defs>
              <linearGradient id={actualId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#1D6FA8" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#1D6FA8" stopOpacity={0}    />
              </linearGradient>
              <linearGradient id={quotaId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#0D9E7E" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#0D9E7E" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fontFamily: "Cairo" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fontFamily: "Cairo" }}
              axisLine={false}
              tickLine={false}
              width={65}
              tickFormatter={(val: number) => val.toLocaleString("ar-EG")}
            />
            <Tooltip
              contentStyle={{
                fontFamily:   "Cairo",
                borderRadius: "8px",
                border:       "1px solid #e5e7eb",
                fontSize:     "12px",
              }}
            />
            <Legend
              wrapperStyle={{ fontFamily: "Cairo", fontSize: "12px" }}
            />
            <Area
              type="monotone"
              dataKey="actual"
              name="الفعلي"
              stroke="#1D6FA8"
              strokeWidth={2}
              fill={`url(#${actualId})`}
              dot={{ r: 4, fill: "#1D6FA8" }}
              isAnimationActive={isVisible}
            />
            <Area
              type="monotone"
              dataKey="quota"
              name="الحصة"
              stroke="#0D9E7E"
              strokeWidth={2}
              strokeDasharray="5 5"
              fill={`url(#${quotaId})`}
              dot={false}
              isAnimationActive={isVisible}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bar Chart — التوزيع حسب المنطقة */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold mb-4 text-right">
          التوزيع حسب المنطقة
        </h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={isVisible ? distributionData : []} barSize={36}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fontFamily: "Cairo" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fontFamily: "Cairo" }}
              axisLine={false}
              tickLine={false}
              width={55}
              tickFormatter={(val: number) => val.toLocaleString("ar-EG")}
            />
            <Tooltip
              contentStyle={{
                fontFamily:   "Cairo",
                borderRadius: "8px",
                border:       "1px solid #e5e7eb",
                fontSize:     "12px",
              }}
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
            />
            <Bar
              dataKey="القيمة (متر مكعب)"
              fill="#0A1628"
              radius={[6, 6, 0, 0]}
              isAnimationActive={isVisible}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}