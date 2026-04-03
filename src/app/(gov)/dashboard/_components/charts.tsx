"use client";

import { useId } from "react";
import { useIntersectionObserver } from "~/lib/hooks";
import { motion } from "framer-motion";
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
  month: string;
  actual: number;
  quota: number;
}

export interface DistributionPoint {
  label: string;
  "القيمة (متر مكعب)": number;
}

interface DashboardChartsProps {
  consumptionData: ConsumptionPoint[];
  distributionData: DistributionPoint[];
}

export function DashboardCharts({
  consumptionData,
  distributionData,
}: DashboardChartsProps) {
  const { targetRef, isVisible } = useIntersectionObserver();
  const actualId = useId();
  const quotaId = useId();

  return (
    <div
      ref={targetRef}
      className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6"
    >
      {/* Line Chart — اتجاه الاستهلاك */}
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ duration: 0.3 }}
        className="group relative overflow-hidden rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-black/5 transition-all hover:shadow-xl"
      >
        <div className="absolute -top-20 -right-20 z-0 h-40 w-40 rounded-full bg-blue-50/50 opacity-0 mix-blend-multiply blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
        <h3 className="relative z-10 mb-6 text-right text-lg font-extrabold tracking-tight text-slate-800">
          الاستهلاك الشهري للمياه
        </h3>
        <div className="relative z-10 h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={isVisible ? consumptionData : []}>
              <defs>
                <linearGradient id={actualId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id={quotaId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f1f5f9"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 13, fill: "#64748b", fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                dy={10}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#94a3b8", fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                width={50}
                tickFormatter={(val: number) => val.toLocaleString("ar-EG")}
                dx={-10}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "16px",
                  border: "none",
                  boxShadow: "0 10px 40px -10px rgba(0,0,0,0.1)",
                  fontSize: "13px",
                  fontWeight: 600,
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  backdropFilter: "blur(12px)",
                }}
                itemStyle={{ fontWeight: 800 }}
              />
              <Legend
                wrapperStyle={{
                  fontSize: "14px",
                  fontWeight: 700,
                  paddingTop: "20px",
                }}
                iconType="circle"
              />
              <Area
                type="monotone"
                dataKey="actual"
                name="الاستهلاك الفعلي"
                stroke="#3B82F6"
                strokeWidth={3}
                fill={`url(#${actualId})`}
                dot={{ r: 4, fill: "#3B82F6", strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                isAnimationActive={isVisible}
                animationDuration={1500}
              />
              <Area
                type="monotone"
                dataKey="quota"
                name="الحصة المخصصة"
                stroke="#10B981"
                strokeWidth={3}
                strokeDasharray="6 6"
                fill={`url(#${quotaId})`}
                dot={false}
                activeDot={{ r: 6, strokeWidth: 0 }}
                isAnimationActive={isVisible}
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Bar Chart — التوزيع حسب المنطقة */}
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ duration: 0.3 }}
        className="group relative overflow-hidden rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-black/5 transition-all hover:shadow-xl"
      >
        <div className="absolute -top-20 -right-20 z-0 h-40 w-40 rounded-full bg-slate-100/50 opacity-0 mix-blend-multiply blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
        <h3 className="relative z-10 mb-6 text-right text-lg font-extrabold tracking-tight text-slate-800">
          التوزيع حسب المنطقة
        </h3>
        <div className="relative z-10 h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={isVisible ? distributionData : []} barSize={24}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f1f5f9"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 13, fill: "#64748b", fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                dy={10}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#94a3b8", fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                width={50}
                tickFormatter={(val: number) =>
                  (val / 1000).toLocaleString("ar-EG") + "k"
                }
                dx={-10}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "16px",
                  border: "none",
                  boxShadow: "0 10px 40px -10px rgba(0,0,0,0.1)",
                  fontSize: "13px",
                  fontWeight: 600,
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  backdropFilter: "blur(12px)",
                }}
                cursor={{ fill: "rgba(241, 245, 249, 0.5)" }}
                itemStyle={{ fontWeight: 800 }}
              />
              <Bar
                dataKey="القيمة (متر مكعب)"
                fill="#0A1628"
                radius={[8, 8, 8, 8]}
                isAnimationActive={isVisible}
                animationDuration={1500}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}
