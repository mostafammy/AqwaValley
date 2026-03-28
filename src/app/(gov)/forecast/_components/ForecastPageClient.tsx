"use client";

import { useState } from "react";
import { useIntersectionObserver } from "~/lib/hooks";
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
    <div ref={targetRef} className="max-w-sm space-y-6 md:max-w-full">
      {isLoading ? (
        <ForecastLoading />
      ) : !forecast || !summary || !monthlyPredictions || !scenarios ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-white py-20 text-center shadow-sm">
          <AlertCircle className="mb-4 h-12 w-12 text-gray-300" />
          <h3 className="mb-2 text-lg font-bold text-gray-900">
            لا توجد بيانات توقعات
          </h3>
          <p className="mx-auto mb-6 max-w-xs text-gray-500">
            لم يتم العثور على بيانات توقعات لهذا المركز حالياً. يرجى المحاولة
            مرة أخرى لاحقاً أو اختيار مركز آخر.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card className="border-l-4 border-l-blue-500 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm text-gray-500">حالة الاستدامة</p>
                <ShieldCheck className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
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

            <Card className="border-l-4 border-l-red-500 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm text-gray-500">معدل الاستنزاف</p>
                <TrendingDown className="h-4 w-4 text-red-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {summary.annualDepletionRateM.toFixed(2)}
              </p>
              <p className="text-xs text-gray-400">متر / سنة</p>
            </Card>

            <Card className="border-l-4 border-l-amber-500 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm text-gray-500">السنوات المتبقية</p>
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {summary.yearsUntilCritical}
              </p>
              <p className="text-xs text-gray-400">حتى الوصول للمستوى الحرج</p>
            </Card>

            <Card className="border-l-4 border-l-gray-800 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm text-gray-500">آخر تحديث</p>
                <AlertCircle className="h-4 w-4 text-gray-400" />
              </div>
              <p className="text-lg font-bold text-gray-900">
                {new Date(summary.lastUpdated).toLocaleDateString("ar-EG")}
              </p>
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
            </Card>
          </div>

          {/* Filter */}
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <label
                htmlFor="district-select"
                className="text-sm font-medium text-gray-600"
              >
                المركز:
              </label>
              <select
                id="district-select"
                value={selectedDistrictId}
                onChange={(e) => setSelectedDistrictId(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Forecast Chart */}
            <div className="h-[400px] rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-6 flex items-center justify-between text-right text-sm font-semibold">
                <span>توقعات منسوب الخزان الجوفي (24 شهر)</span>
                <span className="text-xs font-normal text-gray-400">
                  العمق بالمتر
                </span>
              </h3>
              <ResponsiveContainer width="100%" height="85%">
                <AreaChart
                  data={isVisible ? monthlyPredictions : []}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorLevel" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickFormatter={(val: string | number) =>
                      Number(val).toLocaleString("ar-EG")
                    }
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      fontSize: "12px",
                    }}
                    labelFormatter={(label: unknown) => {
                      if (typeof label === "string" || typeof label === "number") {
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
                    strokeWidth={3}
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

            {/* Scenario Analysis Chart */}
            <div className="h-[400px] rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-6 text-right text-sm font-semibold">
                تحليل سيناريوهات الاستهلاك المائي
              </h3>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={isVisible ? scenarios : []}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f1f5f9"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickFormatter={(val: string | number) =>
                      Number(val).toLocaleString("ar-EG")
                    }
                    width={40}
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

          {/* Scenario Table */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 p-4">
              <h3 className="text-sm font-semibold">تفاصيل السيناريوهات</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right" dir="rtl">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                      السيناريو
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                      الوصف
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                      تأثير الاستهلاك
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
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
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {scenario.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {scenario.description}
                      </td>
                      <td className="px-6 py-4">
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
                      <td className="px-6 py-4 font-semibold text-blue-600">
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
