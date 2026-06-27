"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useIntersectionObserver } from "~/lib/hooks";
import { tapFeedback } from "~/lib/motion";
import { api } from "~/trpc/react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card } from "~/app/_components/UI/Card";
import { Badge } from "~/app/_components/UI/Badge";
import { AlertCircle, TrendingDown, Clock, ShieldCheck } from "lucide-react";
import ForecastLoading from "../loading";

interface District {
  id: string;
  name: string;
}

interface ForecastPageClientProps {
  districts: District[];
}

export function ForecastPageClient({ districts }: ForecastPageClientProps) {
  const { targetRef, isVisible } = useIntersectionObserver();
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>(
    districts[0]?.id ?? "",
  );

  const { data: forecast, isLoading } =
    api.forecast.getDistrictForecast.useQuery(
      { districtId: selectedDistrictId },
      { enabled: !!selectedDistrictId },
    );

  const { summary, monthlyPredictions, scenarios } = forecast ?? {};

  return (
    <div
      ref={targetRef}
      className="min-w-0 w-full space-y-4 overflow-x-hidden md:space-y-6"
    >
      {isLoading ? (
        <ForecastLoading />
      ) : !forecast || !summary || !monthlyPredictions || !scenarios ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-white px-4 py-16 text-center shadow-sm sm:py-20">
          <AlertCircle className="mb-4 h-12 w-12 text-gray-300" />
          <h3 className="mb-2 text-base font-bold text-gray-900 sm:text-lg">
            لا توجد بيانات توقعات
          </h3>
          <p className="mx-auto mb-6 max-w-xs text-sm leading-relaxed text-gray-500">
            لم يتم العثور على بيانات توقعات لهذا المركز حالياً. يرجى المحاولة
            مرة أخرى لاحقاً أو اختيار مركز آخر.
          </p>
          <motion.button
            whileTap={tapFeedback}
            onClick={() => window.location.reload()}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
          >
            إعادة المحاولة
          </motion.button>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            <Card className="min-w-0 border-l-4 border-l-blue-500 p-3 sm:p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="truncate text-xs text-gray-500 sm:text-sm">
                  حالة الاستدامة
                </p>
                <ShieldCheck className="h-4 w-4 shrink-0 text-blue-500" />
              </div>
              <p className="text-xl font-bold text-gray-900 sm:text-2xl">
                {Math.round(
                  Math.min(100, Math.max(0, summary.sustainabilityScore)),
                )}
                %
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full ${
                    summary.sustainabilityScore > 70
                      ? "bg-green-500"
                      : summary.sustainabilityScore > 40
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(0, summary.sustainabilityScore))}%`,
                  }}
                />
              </div>
            </Card>

            <Card className="min-w-0 border-l-4 border-l-red-500 p-3 sm:p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="truncate text-xs text-gray-500 sm:text-sm">
                  معدل الاستنزاف
                </p>
                <TrendingDown className="h-4 w-4 shrink-0 text-red-500" />
              </div>
              <p className="text-xl font-bold text-gray-900 sm:text-2xl">
                {summary.annualDepletionRateM.toFixed(2)}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">متر / سنة</p>
            </Card>

            <Card className="min-w-0 border-l-4 border-l-amber-500 p-3 sm:p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="truncate text-xs text-gray-500 sm:text-sm">
                  السنوات المتبقية
                </p>
                <Clock className="h-4 w-4 shrink-0 text-amber-500" />
              </div>
              <p className="text-xl font-bold text-gray-900 sm:text-2xl">
                {summary.yearsUntilCritical}
              </p>
              <p className="mt-0.5 text-xs leading-tight text-gray-400">
                حتى الوصول للمستوى الحرج
              </p>
            </Card>

            <Card className="min-w-0 border-l-4 border-l-gray-800 p-3 sm:p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="truncate text-xs text-gray-500 sm:text-sm">
                  آخر تحديث
                </p>
                <AlertCircle className="h-4 w-4 shrink-0 text-gray-400" />
              </div>
              <p className="text-base font-bold text-gray-900 sm:text-lg">
                {new Date(summary.lastUpdated).toLocaleDateString("ar-EG")}
              </p>
              <div className="mt-1">
                <Badge
                  variant={
                    summary.trend === "stable"
                      ? "ok"
                      : summary.trend === "declining"
                        ? "warn"
                        : "danger"
                  }
                >
                  {summary.trend === "stable"
                    ? "مستقر"
                    : summary.trend === "declining"
                      ? "متناقص"
                      : "حرج"}
                </Badge>
              </div>
            </Card>
          </div>

          {/* Filter */}
          <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 sm:p-4">
            <div className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
              <label
                htmlFor="district-select"
                className="shrink-0 text-xs font-medium text-gray-600 sm:text-sm"
              >
                المركز:
              </label>
              <select
                id="district-select"
                value={selectedDistrictId}
                onChange={(e) => setSelectedDistrictId(e.target.value)}
                className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none sm:w-auto sm:px-4"
              >
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
            {/* Forecast Chart */}
            <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4 md:p-5">
              <div className="mb-4 flex flex-col gap-1 text-right sm:mb-6 md:flex-row md:items-center md:justify-between">
                <h3 className="text-sm leading-snug font-semibold break-words">
                  توقعات منسوب الخزان الجوفي (24 شهر)
                </h3>
                <span className="text-xs font-normal text-gray-400">
                  العمق بالمتر
                </span>
              </div>
              <div className="h-[260px] w-full sm:h-[340px] md:h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={isVisible ? monthlyPredictions : []}
                    margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="colorLevel"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#3b82f6"
                          stopOpacity={0.1}
                        />
                        <stop
                          offset="95%"
                          stopColor="#3b82f6"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#f1f5f9"
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(val: string | number) =>
                        new Date(val).toLocaleDateString("ar-EG", {
                          month: "short",
                          year: "2-digit",
                        })
                      }
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      axisLine={false}
                      interval="preserveStartEnd"
                      minTickGap={12}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      axisLine={false}
                      tickFormatter={(val: string | number) =>
                        Number(val).toLocaleString("ar-EG")
                      }
                      width={36}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                        fontSize: "12px",
                      }}
                      labelFormatter={(label: unknown) => {
                        if (
                          typeof label === "string" ||
                          typeof label === "number"
                        ) {
                          return new Date(label).toLocaleDateString("ar-EG", {
                            month: "long",
                            year: "numeric",
                          });
                        }
                        return "";
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="predictedLevel"
                      name="المنسوب المتوقع"
                      stroke="#3b82f6"
                      fillOpacity={1}
                      fill="url(#colorLevel)"
                      strokeWidth={2}
                      isAnimationActive={isVisible}
                    />
                    <ReferenceLine
                      y={summary.currentLevelM}
                      label={{
                        value: "الحالي",
                        position: "right",
                        fill: "#94a3b8",
                        fontSize: 10,
                      }}
                      stroke="#94a3b8"
                      strokeDasharray="3 3"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Scenario Analysis Chart */}
            <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4 md:p-5">
              <h3 className="mb-4 text-right text-sm leading-snug font-semibold sm:mb-6">
                تحليل سيناريوهات الاستهلاك المائي
              </h3>
              <div className="h-[260px] w-full sm:h-[340px] md:h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={isVisible ? scenarios : []}
                    margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#f1f5f9"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      axisLine={false}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      axisLine={false}
                      tickFormatter={(val: string | number) =>
                        Number(val).toLocaleString("ar-EG")
                      }
                      width={36}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                        fontSize: "12px",
                      }}
                    />
                    <Bar
                      dataKey="predictedLevelAfter12m"
                      name="المنسوب المتوقع بعد سنة"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={isVisible}
                    >
                      {scenarios.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.impactOnDepletionPct < 0
                              ? "#10b981"
                              : entry.impactOnDepletionPct === 0
                                ? "#3b82f6"
                                : "#ef4444"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Scenario Table */}
          <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 p-3 sm:p-4">
              <h3 className="text-sm font-semibold break-words">
                تفاصيل السيناريوهات
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-right" dir="rtl">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase sm:px-6 sm:py-4">
                      السيناريو
                    </th>
                    <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase sm:px-6 sm:py-4">
                      الوصف
                    </th>
                    <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase sm:px-6 sm:py-4">
                      تأثير الاستهلاك
                    </th>
                    <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase sm:px-6 sm:py-4">
                      المنسوب المتوقع (سنة)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {scenarios.map((scenario) => (
                    <tr
                      key={scenario.id}
                      className="transition-colors hover:bg-gray-50"
                    >
                      <td className="px-3 py-3 text-sm font-medium text-gray-900 break-words sm:px-6 sm:py-4">
                        {scenario.name}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-600 break-words sm:px-6 sm:py-4 sm:text-sm">
                        {scenario.description}
                      </td>
                      <td className="px-3 py-3 sm:px-6 sm:py-4">
                        <Badge
                          variant={
                            scenario.impactOnDepletionPct < 0
                              ? "ok"
                              : scenario.impactOnDepletionPct === 0
                                ? "gray"
                                : "danger"
                          }
                        >
                          {scenario.impactOnDepletionPct > 0 ? "+" : ""}
                          {scenario.impactOnDepletionPct}%
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-sm font-semibold whitespace-nowrap text-blue-600 sm:px-6 sm:py-4">
                        {scenario.predictedLevelAfter12m} م
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
