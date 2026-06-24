"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useIntersectionObserver } from "~/lib/hooks";
import { tapFeedback } from "~/lib/motion";
import { 
  useWellMetrics, 
  RANGES, 
  type RangeKey, 
  type SensorType 
} from "./use-well-metrics";
import { ChartStatsBar } from "./chart-stats-bar";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import { Download, Activity, Droplets, Gauge, Thermometer, ThermometerSun } from "lucide-react";

interface ReadingsChartProps {
  wellId: string;
  depthM: number | null;
  currentValue: number | null;
  thresholds?: {
    min?: number;
    max?: number;
  };
}

const SENSOR_TYPES: { key: SensorType; label: string; icon: React.ReactNode }[] = [
  { key: "water_level", label: "المنسوب", icon: <Droplets size={14} /> },
  { key: "pressure", label: "الضغط", icon: <Gauge size={14} /> },
  { key: "flow_rate", label: "التدفق", icon: <Activity size={14} /> },
  { key: "humidity", label: "الرطوبة", icon: <ThermometerSun size={14} /> },
  { key: "temperature", label: "الحرارة", icon: <Thermometer size={14} /> },
];

export function ReadingsChart({ wellId, depthM, currentValue, thresholds }: ReadingsChartProps) {
  const { targetRef, isVisible } = useIntersectionObserver();
  const [activeRange, setActiveRange] = useState<RangeKey>("1w");
  const [activeSensor, setActiveSensor] = useState<SensorType>("water_level");
  const [compare, setCompare] = useState(false);

  const { data, isLoading, isError } = useWellMetrics(
    wellId, 
    activeRange, 
    activeSensor, 
    compare
  );

  const rows = data?.rows ?? [];
  const comparisonRows = data?.comparisonRows ?? [];
  const unit = rows[0]?.unit ?? (activeSensor === "water_level" ? "متر" : "");

  // Merge current and comparison data for Recharts if comparing
  const mergedData = rows.map((r, i) => {
    const compRow = comparisonRows[i];
    return {
      ...r,
      comp_avg: compRow?.avg_value,
      // For charting we might want to align them on the same X axis point
      // But Recharts composed chart works best when data is together
    };
  });

  const handleExport = () => {
    const cfg = RANGES.find((r) => r.key === activeRange)!;
    window.open(`/api/wells/${wellId}/metrics?range=${cfg.range}h&bucket=${cfg.bucket}m&sensorType=${activeSensor}&format=csv`);
  };

  return (
    <div
      ref={targetRef}
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      {/* Header + Actions */}
      <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Sensor Type Selector */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 self-start">
          {SENSOR_TYPES.map((s) => (
            <motion.button
              whileTap={tapFeedback}
              key={s.key}
              onClick={() => setActiveSensor(s.key)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                activeSensor === s.key
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {s.icon}
              {s.label}
            </motion.button>
          ))}
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          {/* Comparison Toggle */}
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input 
              type="checkbox" 
              checked={compare}
              onChange={(e) => setCompare(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            مقارنة بالفترة السابقة
          </label>

          {/* Export Button */}
          <button 
            onClick={handleExport}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors"
          >
            <Download size={14} />
            <span className="hidden sm:inline">تصدير CSV</span>
          </button>
        </div>
      </div>

      {/* Range Tabs */}
      <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">
            {activeSensor === "water_level" ? "قراءات منسوب المياه" : 
             activeSensor === "pressure" ? "قراءات الضغط" : "معدل التدفق"}
          </h3>
          {isLoading && (
            <span className="animate-pulse text-xs text-gray-400">
              جاري التحديث...
            </span>
          )}
        </div>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {RANGES.map((r) => (
            <motion.button
              whileTap={tapFeedback}
              key={r.key}
              onClick={() => setActiveRange(r.key)}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                activeRange === r.key
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {r.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Chart Area */}
      {isError ? (
        <div className="flex h-64 items-center justify-center text-sm text-red-400">
          فشل تحميل البيانات
        </div>
      ) : isLoading && rows.length === 0 ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center text-sm text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
          <Activity className="mb-2 text-gray-300" size={24} />
          لا توجد بيانات لهذه الفترة
        </div>
      ) : (
        <div className="relative">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart
              data={isVisible ? mergedData : []}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="levelGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1D6FA8" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#1D6FA8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f0f0f0"
                vertical={false}
              />
              <XAxis
                dataKey="bucket"
                tick={{ fontSize: 10, fontFamily: "Cairo" }}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
                tickFormatter={(val: string) => {
                  const d = new Date(val);
                  if (activeRange === "1d") return d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
                  if (activeRange === "1w") return d.toLocaleDateString("ar-EG", { weekday: "short", day: "numeric" });
                  if (activeRange === "1m") return d.toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
                  return d.toLocaleDateString("ar-EG", { month: "short" });
                }}
              />
              <YAxis
                tick={{ fontSize: 11, fontFamily: "Cairo" }}
                axisLine={false}
                tickLine={false}
                width={45}
                domain={activeSensor === "water_level" && depthM ? [0, depthM] : ["auto", "auto"]}
                tickFormatter={(v: number) => `${v.toFixed(1)}`}
              />
              <Tooltip
                contentStyle={{
                  fontFamily: "Cairo",
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                  fontSize: "12px",
                  direction: "rtl",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
                labelFormatter={(label: unknown) => {
                  if (!label) return "";
                  return new Date(label as string).toLocaleString("ar-EG");
                }}
                formatter={(value: unknown, name: unknown) => {
                  const valNum = Number(value);
                  const nameStr = String(name);
                  if (nameStr === "avg_value") return [`${valNum.toFixed(2)} ${unit}`, "المتوسط"];
                  if (nameStr === "comp_avg") return [`${valNum.toFixed(2)} ${unit}`, "السابق"];
                  return [valNum, nameStr];
                }}
              />
              
              {/* Threshold Lines */}
              {thresholds?.max && (
                <ReferenceLine 
                  y={thresholds.max} 
                  stroke="#EF4444" 
                  strokeDasharray="4 4" 
                  label={{ position: "insideTopLeft", value: "الحد الأقصى", fill: "#EF4444", fontSize: 10, fontFamily: "Cairo" }} 
                />
              )}
              {thresholds?.min && (
                <ReferenceLine 
                  y={thresholds.min} 
                  stroke="#F59E0B" 
                  strokeDasharray="4 4" 
                  label={{ position: "insideBottomLeft", value: "الحد الأدنى", fill: "#F59E0B", fontSize: 10, fontFamily: "Cairo" }} 
                />
              )}

              {/* Min/Max Confidence Band */}
              <Area
                type="monotone"
                dataKey="max_value"
                stroke="none"
                fill="#1D6FA8"
                fillOpacity={0.05}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="min_value"
                stroke="none"
                fill="#fff"
                fillOpacity={1}
                isAnimationActive={false}
              />

              {/* Comparison Line (if active) */}
              {compare && (
                <Line
                  type="monotone"
                  dataKey="comp_avg"
                  stroke="#9CA3AF"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  isAnimationActive={isVisible}
                />
              )}

              {/* Main Average Line */}
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
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Stats Bar */}
      <ChartStatsBar currentValue={currentValue} unit={unit} rows={rows} />

      {/* Live indicator */}
      <div className="mt-4 flex items-center justify-end gap-1.5">
        <span className="h-2 w-2 animate-pulse rounded-full bg-teal-500" />
        <span className="text-xs text-gray-400">تحديث تلقائي</span>
      </div>
    </div>
  );
}
