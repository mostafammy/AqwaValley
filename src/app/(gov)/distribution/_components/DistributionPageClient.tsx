"use client";

import { useState, useMemo } from "react";
import { useIntersectionObserver } from "~/lib/hooks";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card } from "~/app/_components/UI/Card";
import { Badge } from "~/app/_components/UI/Badge";
import { ConsumerTypeChart } from "./ConsumerTypeChart";

interface DistrictStats {
  id: string;
  name: string;
  totalQuota: number;
  totalConsumption: number;
  utilizationPct: number;
  effectiveState: "ok" | "warning" | "critical";
  wellCount: number;
}

interface TrendPoint {
  month: string;
  actual: number;
  quota: number;
}

interface Summary {
  totalQuota: number;
  totalConsumption: number;
  avgUtilization: number;
  totalWells: number;
  districtCount: number;
}

interface DistributionPageClientProps {
  districts: DistrictStats[];
  trendData: TrendPoint[];
  summary: Summary;
}

const STATE_COLORS = {
  ok: "#22c55e",
  warning: "#f59e0b",
  critical: "#ef4444",
};

const STATE_LABELS = {
  ok: "طبيعي",
  warning: "تحذير",
  critical: "حرج",
};

const PIE_COLORS = ["#1D6FA8", "#0D9E7E", "#0A1628", "#f59e0b", "#22c55e"];

export function DistributionPageClient({
  districts,
  trendData,
  summary: _summary,
}: DistributionPageClientProps) {
  const { targetRef: trendRef, isVisible: trendVisible } =
    useIntersectionObserver();
  const { targetRef: barRef, isVisible: barVisible } =
    useIntersectionObserver();
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");

  // Filter districts based on selection
  const filteredDistricts = useMemo(() => {
    if (selectedDistrict === "all") return districts;
    return districts.filter((d) => d.id === selectedDistrict);
  }, [districts, selectedDistrict]);

  // Prepare pie chart data - quota distribution
  const pieData = useMemo(() => {
    return filteredDistricts.map((d) => ({
      name: d.name,
      value: d.totalQuota,
      consumed: d.totalConsumption,
      remaining: Math.max(0, d.totalQuota - d.totalConsumption),
      utilization: d.utilizationPct,
    }));
  }, [filteredDistricts]);

  // Calculate summary for filtered data
  const filteredSummary = useMemo(() => {
    const totalQuota = filteredDistricts.reduce(
      (sum, d) => sum + d.totalQuota,
      0,
    );
    const totalConsumption = filteredDistricts.reduce(
      (sum, d) => sum + d.totalConsumption,
      0,
    );
    const avgUtilization =
      totalQuota > 0 ? (totalConsumption / totalQuota) * 100 : 0;
    const totalWells = filteredDistricts.reduce(
      (sum, d) => sum + d.wellCount,
      0,
    );

    return {
      totalQuota,
      totalConsumption,
      avgUtilization,
      totalWells,
      districtCount: filteredDistricts.length,
    };
  }, [filteredDistricts]);

  // Prepare bar chart data
  const barData = useMemo(() => {
    return filteredDistricts.map((d) => ({
      name: d.name,
      "الاستهلاك (م³)": d.totalConsumption,
      "المتبقي (م³)": Math.max(0, d.totalQuota - d.totalConsumption),
    }));
  }, [filteredDistricts]);

  return (
    <div className="flex w-full flex-col gap-4 md:gap-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Card className="p-3 sm:p-4">
          <p className="mb-1 text-[11px] text-gray-500 sm:text-sm">إجمالي الحصة</p>
          <p className="text-lg font-bold text-gray-900 sm:text-2xl">
            {filteredSummary.totalQuota.toLocaleString("ar-EG")}
          </p>
          <p className="text-[10px] text-gray-400 sm:text-xs">متر مكعب / شهر</p>
        </Card>

        <Card className="p-3 sm:p-4">
          <p className="mb-1 text-[11px] text-gray-500 sm:text-sm">الاستهلاك المقدر</p>
          <p className="text-lg font-bold text-blue-600 sm:text-2xl">
            {filteredSummary.totalConsumption.toLocaleString("ar-EG")}
          </p>
          <p className="text-[10px] text-gray-400 sm:text-xs">متر مكعب / شهر</p>
        </Card>

        <Card className="p-3 sm:p-4">
          <p className="mb-1 text-[11px] text-gray-500 sm:text-sm">نسبة الاستغلال</p>
          <p
            className={`text-lg font-bold sm:text-2xl ${
              filteredSummary.avgUtilization >= 100
                ? "text-red-600"
                : filteredSummary.avgUtilization >= 80
                  ? "text-yellow-600"
                  : "text-green-600"
            }`}
          >
            {filteredSummary.avgUtilization.toFixed(1)}%
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200 sm:h-2">
            <div
              className={`h-full rounded-full transition-all ${
                filteredSummary.avgUtilization >= 100
                  ? "bg-red-500"
                  : filteredSummary.avgUtilization >= 80
                    ? "bg-yellow-500"
                    : "bg-green-500"
              }`}
              style={{
                width: `${Math.min(filteredSummary.avgUtilization, 100)}%`,
              }}
            />
          </div>
        </Card>

        <Card className="p-3 sm:p-4">
          <p className="mb-1 text-[11px] text-gray-500 sm:text-sm">عدد الآبار</p>
          <p className="text-lg font-bold text-gray-900 sm:text-2xl">
            {filteredSummary.totalWells}
          </p>
          <p className="text-[10px] text-gray-400 sm:text-xs">
            في {filteredSummary.districtCount} مركز
          </p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 bg-white p-3 shadow-sm sm:gap-3 sm:p-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
          <label
            htmlFor="district-select"
            className="text-xs font-medium text-gray-600 sm:text-sm"
          >
            المركز:
          </label>
          <select
            id="district-select"
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none sm:flex-none sm:px-3 sm:py-2 sm:text-sm"
          >
            <option value="all">الكل</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Charts Grid */}
      <div ref={trendRef} className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
        {/* Consumption Trend Chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-5">
          <h3 className="mb-3 text-right text-xs font-semibold sm:mb-4 sm:text-sm">
            اتجاه الاستهلاك
          </h3>
          <ResponsiveContainer width="100%" height={220} minHeight={220}>
            <AreaChart data={trendVisible ? trendData : []} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1D6FA8" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1D6FA8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorQuota" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0D9E7E" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#0D9E7E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fontFamily: "Cairo" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={20}
              />
              <YAxis
                tick={{ fontSize: 9, fontFamily: "Cairo" }}
                axisLine={false}
                tickLine={false}
                width={45}
                tickFormatter={(val: number) => val.toLocaleString("ar-EG")}
              />
              <Tooltip
                contentStyle={{
                  fontFamily: "Cairo",
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                  fontSize: "12px",
                }}
              />
              <Legend
                wrapperStyle={{ fontFamily: "Cairo", fontSize: "11px" }}
              />
              <Area
                type="monotone"
                dataKey="actual"
                name="الفعلي"
                stroke="#1D6FA8"
                strokeWidth={2}
                fill="url(#colorActual)"
                dot={{ r: 3, fill: "#1D6FA8" }}
                isAnimationActive={trendVisible}
              />
              <Area
                type="monotone"
                dataKey="quota"
                name="الحصة"
                stroke="#0D9E7E"
                strokeWidth={2}
                strokeDasharray="5 5"
                fill="url(#colorQuota)"
                dot={false}
                isAnimationActive={trendVisible}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart - Quota Distribution */}
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-5">
          <h3 className="mb-3 text-right text-xs font-semibold sm:mb-4 sm:text-sm">
            توزيع الحصص على المراكز
          </h3>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <div className="h-[200px] w-full sm:h-[240px] sm:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={trendVisible ? pieData : []}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    isAnimationActive={trendVisible}
                  >
                    {pieData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      fontFamily: "Cairo",
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full space-y-1.5 sm:w-1/2">
              {pieData.map((entry, index) => (
                <div
                  key={entry.name}
                  className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-2.5 py-1.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                    />
                    <span className="truncate text-xs text-gray-700 sm:text-sm">{entry.name}</span>
                  </div>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-800 sm:text-sm">
                    {entry.value.toLocaleString("ar-EG")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-2">
        {/* Consumer Type Donut Chart */}
        <ConsumerTypeChart />
        {/* Quota vs Consumption Bar Chart */}
        <div
          ref={barRef}
          className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-5"
        >
          <h3 className="mb-3 text-right text-xs font-semibold sm:mb-4 sm:text-sm">
            الاستهلاك مقابل الحصة المتبقية
          </h3>
          <ResponsiveContainer width="100%" height={240} minHeight={240}>
            <BarChart data={barVisible ? barData : []} barCategoryGap="20%" margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f0f0f0"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fontFamily: "Cairo" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={20}
              />
              <YAxis
                tick={{ fontSize: 9, fontFamily: "Cairo" }}
                axisLine={false}
                tickLine={false}
                width={45}
                tickFormatter={(val: number) => val.toLocaleString("ar-EG")}
              />
              <Tooltip
                contentStyle={{
                  fontFamily: "Cairo",
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                  fontSize: "12px",
                }}
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
              />
              <Legend
                wrapperStyle={{ fontFamily: "Cairo", fontSize: "11px" }}
              />
              <Bar
                dataKey="الاستهلاك (م³)"
                fill="#1D6FA8"
                name="الاستهلاك"
                radius={[4, 4, 0, 0]}
                isAnimationActive={barVisible}
              />
              <Bar
                dataKey="المتبقي (م³)"
                fill="#0D9E7E"
                name="المتبقي"
                radius={[4, 4, 0, 0]}
                isAnimationActive={barVisible}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* District Details - Mobile card view */}
      <div className="block md:hidden">
        <div className="space-y-2">
          <h3 className="px-1 text-sm font-semibold">تفاصيل المراكز</h3>
          {filteredDistricts.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-400 shadow-sm">
              لا توجد بيانات
            </div>
          ) : (
            filteredDistricts.map((district) => {
              const remaining = Math.max(0, district.totalQuota - district.totalConsumption);
              return (
                <div
                  key={district.id}
                  className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-gray-900">
                      {district.name}
                    </span>
                    <Badge
                      variant={
                        district.effectiveState === "ok"
                          ? "ok"
                          : district.effectiveState === "warning"
                            ? "warn"
                            : "danger"
                      }
                    >
                      {STATE_LABELS[district.effectiveState]}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-gray-50 px-2 py-1.5">
                      <div className="text-[9px] font-medium text-gray-500">الحصة</div>
                      <div className="text-xs font-bold tabular-nums text-gray-700">
                        {district.totalQuota.toLocaleString("ar-EG")}
                      </div>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-2 py-1.5">
                      <div className="text-[9px] font-medium text-gray-500">الاستهلاك</div>
                      <div className="text-xs font-bold tabular-nums text-blue-600">
                        {district.totalConsumption.toLocaleString("ar-EG")}
                      </div>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-2 py-1.5">
                      <div className="text-[9px] font-medium text-gray-500">المتبقي</div>
                      <div
                        className={`text-xs font-bold tabular-nums ${
                          remaining > 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {remaining.toLocaleString("ar-EG")}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(district.utilizationPct, 100)}%`,
                          backgroundColor: STATE_COLORS[district.effectiveState],
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-medium tabular-nums text-gray-500">
                      {district.utilizationPct.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-gray-400">· {district.wellCount} بئر</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* District Details Table - Desktop view */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-4">
          <h3 className="text-sm font-semibold">تفاصيل المراكز</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                  المركز
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                  الحصة (م³/شهر)
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                  الاستهلاك
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                  المتبقي
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                  الاستغلال
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                  الحالة
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                  الآبار
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredDistricts.map((district) => {
                const remaining = Math.max(
                  0,
                  district.totalQuota - district.totalConsumption,
                );
                return (
                  <tr
                    key={district.id}
                    className="transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {district.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {district.totalQuota.toLocaleString("ar-EG")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-blue-600">
                        {district.totalConsumption.toLocaleString("ar-EG")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-sm font-medium ${
                          remaining > 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {remaining.toLocaleString("ar-EG")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(district.utilizationPct, 100)}%`,
                              backgroundColor:
                                STATE_COLORS[district.effectiveState],
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {district.utilizationPct.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          district.effectiveState === "ok"
                            ? "ok"
                            : district.effectiveState === "warning"
                              ? "warn"
                              : "danger"
                        }
                      >
                        {STATE_LABELS[district.effectiveState]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {district.wellCount}
                    </td>
                  </tr>
                );
              })}
              {filteredDistricts.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    لا توجد بيانات
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
