"use client";

import { useState, useMemo } from "react";
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
  summary,
}: DistributionPageClientProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<"monthly" | "daily">("monthly");
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
    const totalQuota = filteredDistricts.reduce((sum, d) => sum + d.totalQuota, 0);
    const totalConsumption = filteredDistricts.reduce((sum, d) => sum + d.totalConsumption, 0);
    const avgUtilization = totalQuota > 0 ? (totalConsumption / totalQuota) * 100 : 0;
    const totalWells = filteredDistricts.reduce((sum, d) => sum + d.wellCount, 0);

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
    <div className="flex flex-col gap-4 max-w-sm md:max-w-full">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-sm text-gray-500 mb-1">إجمالي الحصة</p>
          <p className="text-2xl font-bold text-gray-900">
            {filteredSummary.totalQuota.toLocaleString("ar-EG")}
          </p>
          <p className="text-xs text-gray-400">متر مكعب / شهر</p>
        </Card>

        <Card className="p-4">
          <p className="text-sm text-gray-500 mb-1">الاستهلاك المقدر</p>
          <p className="text-2xl font-bold text-blue-600">
            {filteredSummary.totalConsumption.toLocaleString("ar-EG")}
          </p>
          <p className="text-xs text-gray-400">متر مكعب / شهر</p>
        </Card>

        <Card className="p-4">
          <p className="text-sm text-gray-500 mb-1">نسبة الاستغلال</p>
          <p className={`text-2xl font-bold ${
            filteredSummary.avgUtilization >= 100
              ? "text-red-600"
              : filteredSummary.avgUtilization >= 80
                ? "text-yellow-600"
                : "text-green-600"
          }`}>
            {filteredSummary.avgUtilization.toFixed(1)}%
          </p>
          <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                filteredSummary.avgUtilization >= 100
                  ? "bg-red-500"
                  : filteredSummary.avgUtilization >= 80
                    ? "bg-yellow-500"
                    : "bg-green-500"
              }`}
              style={{ width: `${Math.min(filteredSummary.avgUtilization, 100)}%` }}
            />
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-sm text-gray-500 mb-1">عدد الآبار</p>
          <p className="text-2xl font-bold text-gray-900">
            {filteredSummary.totalWells}
          </p>
          <p className="text-xs text-gray-400">
            في {filteredSummary.districtCount} مركز
          </p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">المركز:</label>
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">الكل</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">الفترة:</label>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setSelectedPeriod("monthly")}
              className={`px-3 py-2 text-sm transition-colors ${
                selectedPeriod === "monthly"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              شهري
            </button>
            <button
              onClick={() => setSelectedPeriod("daily")}
              className={`px-3 py-2 text-sm transition-colors ${
                selectedPeriod === "daily"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              يومي
            </button>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Consumption Trend Chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold mb-4 text-right">
            اتجاه الاستهلاك
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trendData}>
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
                  fontFamily: "Cairo",
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontFamily: "Cairo", fontSize: "12px" }} />
              <Area
                type="monotone"
                dataKey="actual"
                name="الفعلي"
                stroke="#1D6FA8"
                strokeWidth={2}
                fill="url(#colorActual)"
                dot={{ r: 4, fill: "#1D6FA8" }}
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
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart - Quota Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold mb-4 text-right">
            توزيع الحصص على المراكز
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
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


      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Consumer Type Donut Chart */}
        <ConsumerTypeChart />
      {/* Quota vs Consumption Bar Chart */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold mb-4 text-right">
          الاستهلاك مقابل الحصة المتبقية
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={barData} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fontFamily: "Cairo" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fontFamily: "Cairo" }}
              axisLine={false}
              tickLine={false}
              width={60}
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
            <Legend wrapperStyle={{ fontFamily: "Cairo", fontSize: "11px" }} />
            <Bar
              dataKey="الاستهلاك (م³)"
              fill="#1D6FA8"
              name="الاستهلاك"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="المتبقي (م³)"
              fill="#0D9E7E"
              name="المتبقي"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      </div>
      {/* District Details Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold">تفاصيل المراكز</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  المركز
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الحصة (م³/شهر)
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الاستهلاك
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  المتبقي
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الاستغلال
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الحالة
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الآبار
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredDistricts.map((district) => {
                const remaining = Math.max(0, district.totalQuota - district.totalConsumption);
                return (
                <tr key={district.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {district.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {district.totalQuota.toLocaleString("ar-EG")}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-blue-600 font-medium">
                      {district.totalConsumption.toLocaleString("ar-EG")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-medium ${
                      remaining > 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {remaining.toLocaleString("ar-EG")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(district.utilizationPct, 100)}%`,
                            backgroundColor: STATE_COLORS[district.effectiveState],
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
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
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
