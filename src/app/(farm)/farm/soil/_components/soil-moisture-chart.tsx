"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export type SoilChartSeries = {
  wellId: string;
  wellName: string;
  color: string;
};

export type SoilChartPoint = {
  label: string;
} & Record<string, number>; // wellId -> value

interface SoilMoistureChartProps {
  data: SoilChartPoint[];
  series: SoilChartSeries[];
}

export function SoilMoistureChart({ data, series }: SoilMoistureChartProps) {
  if (data.length === 0 || series.length === 0) {
    return (
      <div className="flex h-[320px] w-full flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-400">
        لا توجد بيانات رطوبة كافية للعرض
      </div>
    );
  }

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 10, right: 20, left: -20, bottom: 10 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#f1f5f9"
          />
          <XAxis
            dataKey="label"
            stroke="#94a3b8"
            fontSize={13}
            tickLine={false}
            axisLine={false}
            dy={8}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={13}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}%`}
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              borderRadius: "16px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
              direction: "rtl",
            }}
            formatter={(value, name) => {
              if (value === undefined || value === null)
                return ["—", name];
              // map wellId back to wellName for tooltip if needed, but Recharts handles `name` via dataKey or name prop on Line.
              return [`${Number(value).toFixed(1)}%`, name];
            }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            wrapperStyle={{ paddingBottom: 20, fontSize: 13 }}
          />
          
          {series.map((s, idx) => (
            <Line
              key={s.wellId}
              type="monotone"
              dataKey={s.wellId}
              name={s.wellName}
              stroke={s.color}
              strokeWidth={3}
              dot={{ r: 4 }}
              animationDuration={1500}
              animationBegin={idx * 300}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
