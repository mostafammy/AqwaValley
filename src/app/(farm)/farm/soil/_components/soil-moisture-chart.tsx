"use client";

import { useMemo } from "react";
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
import type { SoilSensorReading } from "~/server/repositories/soil-data.repository";

export type SoilChartSeries = {
  wellId: string;
  wellName: string;
  color: string;
};

export type SoilChartPoint = {
  label: string;
  [wellId: string]: string | number;
};

const ZONE_COLORS = ["#D97706", "#0D9E7E", "#1D6FA8", "#9333EA", "#E11D48"];

interface SoilMoistureChartProps {
  readings: SoilSensorReading[];
  series?: SoilChartSeries[];
}

function formatLabel(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("ar-EG", {
    weekday: "short",
    day: "2-digit",
  });
}

function makeKey(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString();
}

export function SoilMoistureChart({
  readings,
  series: providedSeries,
}: SoilMoistureChartProps) {
  const { data, series } = useMemo(() => {
    const derivedSeries: SoilChartSeries[] =
      providedSeries && providedSeries.length > 0
        ? providedSeries
        : Array.from(
            readings
              .reduce((acc, r) => {
                if (!acc.has(r.wellId)) {
                  acc.set(r.wellId, {
                    wellId: r.wellId,
                    wellName: r.wellName,
                  });
                }
                return acc;
              }, new Map<string, Omit<SoilChartSeries, "color">>())
              .values(),
          ).map((s, i) => ({
            ...s,
            color: ZONE_COLORS[i % ZONE_COLORS.length]!,
          }));
    const pointByKey = new Map<string, SoilChartPoint>();

    for (const reading of readings) {
      if (reading.value === null || reading.value === undefined) continue;
      if (!reading.lastUpdatedAt) continue;

      const key = makeKey(reading.lastUpdatedAt);
      const label = formatLabel(reading.lastUpdatedAt);

      let point = pointByKey.get(key);
      if (!point) {
        point = { label };
        pointByKey.set(key, point);
      }
      point[reading.wellId] = reading.value;
    }

    const ordered = Array.from(pointByKey.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([, point]) => point);

    return {
      data: ordered,
      series: derivedSeries,
    };
  }, [readings, providedSeries]);

  if (data.length === 0 || series.length === 0) {
    return (
      <div className="flex h-[260px] w-full flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-400 sm:h-[320px]">
        لا توجد بيانات رطوبة كافية للعرض
      </div>
    );
  }

  return (
    <div className="h-[260px] w-full sm:h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 10, right: 8, left: 0, bottom: 10 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#f1f5f9"
          />
          <XAxis
            dataKey="label"
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            dy={8}
            interval="preserveStartEnd"
            minTickGap={8}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}%`}
            domain={[0, 100]}
            width={36}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              borderRadius: "16px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
              direction: "rtl",
              fontSize: "12px",
            }}
            formatter={(value, name) => {
              if (value === undefined || value === null)
                return ["—", name];
              return [`${Number(value).toFixed(1)}%`, name];
            }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            wrapperStyle={{ paddingBottom: 12, fontSize: 12 }}
          />

          {series.map((s, idx) => (
            <Line
              key={s.wellId}
              type="monotone"
              dataKey={s.wellId}
              name={s.wellName}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 3 }}
              animationDuration={1500}
              animationBegin={idx * 300}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
