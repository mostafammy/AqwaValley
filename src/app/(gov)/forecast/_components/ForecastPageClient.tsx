"use client";

import { useState } from "react";
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
  Legend,
  ReferenceLine,
} from "recharts";
import { Card } from "~/app/_components/UI/Card";
import { Badge } from "~/app/_components/UI/Badge";
import { AlertCircle, TrendingDown, Clock, ShieldCheck } from "lucide-react";

interface District {
  id: string;
  name: string;
}

interface ForecastPageClientProps {
  districts: District[];
}

export function ForecastPageClient({ districts }: ForecastPageClientProps) {
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>(
    districts[0]?.id ?? "",
  );

  const { data: forecast, isLoading } = api.forecast.getDistrictForecast.useQuery(
    { districtId: selectedDistrictId },
    { enabled: !!selectedDistrictId },
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!forecast) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-xl border border-gray-100 shadow-sm">
        <AlertCircle className="w-12 h-12 text-gray-300 mb-4" />
        <h3 className="text-lg font-bold text-gray-900 mb-2">لا توجد بيانات توقعات</h3>
        <p className="text-gray-500 max-w-xs mx-auto mb-6">
          لم يتم العثور على بيانات توقعات لهذا المركز حالياً. يرجى المحاولة مرة أخرى لاحقاً أو اختيار مركز آخر.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const { summary, monthlyPredictions, scenarios } = forecast;

  return (
    <div className="space-y-6 max-w-sm  md:max-w-full">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500">حالة الاستدامة</p>
            <ShieldCheck className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{Math.round(Math.min(100, Math.max(0, summary.sustainabilityScore)))}%</p>
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                summary.sustainabilityScore > 70
                  ? "bg-green-500"
                  : summary.sustainabilityScore > 40
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }`}
              style={{ width: `${Math.min(100, Math.max(0, summary.sustainabilityScore))}%` }}
            />
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-red-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500">معدل الاستنزاف</p>
            <TrendingDown className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {summary.annualDepletionRateM.toFixed(2)}
          </p>
          <p className="text-xs text-gray-400">متر / سنة</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500">السنوات المتبقية</p>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{summary.yearsUntilCritical}</p>
          <p className="text-xs text-gray-400">حتى الوصول للمستوى الحرج</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-gray-800">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500">آخر تحديث</p>
            <AlertCircle className="w-4 h-4 text-gray-400" />
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
            {summary.trend === "stable" ? "مستقر" : summary.trend === "declining" ? "متناقص" : "حرج"}
          </Badge>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-2">
          <label htmlFor="district-select" className="text-sm font-medium text-gray-600">المركز:</label>
          <select
            id="district-select"
            value={selectedDistrictId}
            onChange={(e) => setSelectedDistrictId(e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Forecast Chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 h-[400px]">
          <h3 className="text-sm font-semibold mb-6 flex justify-between items-center text-right">
            <span>توقعات منسوب الخزان الجوفي (24 شهر)</span>
            <span className="text-xs font-normal text-gray-400">العمق بالمتر</span>
          </h3>
          <ResponsiveContainer width="100%" height="85%">
            <AreaChart data={monthlyPredictions} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorLevel" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tickFormatter={(val) =>
                  new Date(val).toLocaleDateString("ar-EG", { month: "short", year: "2-digit" })
                }
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickFormatter={(val) => val.toLocaleString("ar-EG")}
                width={40}
              />
              <Tooltip
                contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                labelFormatter={(label) => new Date(label).toLocaleDateString("ar-EG", { month: "long", year: "numeric" })}
              />
              <Area
                type="monotone"
                dataKey="predictedLevel"
                name="المنسوب المتوقع"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorLevel)"
                strokeWidth={3}
              />
              <ReferenceLine
                y={summary.currentLevelM}
                label={{ value: "الحالي", position: "right", fill: "#94a3b8", fontSize: 10 }}
                stroke="#94a3b8"
                strokeDasharray="3 3"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Scenario Analysis Chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 h-[400px]">
          <h3 className="text-sm font-semibold mb-6 text-right">
            تحليل سيناريوهات الاستهلاك المائي
          </h3>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={scenarios}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickFormatter={(val) => val.toLocaleString("ar-EG")}
                width={40}
              />
              <Tooltip
                contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }}
              />
              <Bar
                dataKey="predictedLevelAfter12m"
                name="المنسوب المتوقع بعد سنة"
                radius={[4, 4, 0, 0]}
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
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold">تفاصيل السيناريوهات</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right" dir="rtl">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">السيناريو</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">الوصف</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">تأثير الاستهلاك</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">المنسوب المتوقع (سنة)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {scenarios.map((scenario) => (
                <tr key={scenario.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{scenario.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{scenario.description}</td>
                  <td className="px-6 py-4">
                    <Badge variant={scenario.impactOnDepletionPct < 0 ? "ok" : scenario.impactOnDepletionPct === 0 ? "gray" : "danger"}>
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
    </div>
  );
}
