"use client";
import { useIntersectionObserver } from "~/lib/hooks";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface ConsumerType {
  name: string;
  label: string;
  value: number;
  color: string;
}

// TODO: wire to real API
const CONSUMER_TYPES: ConsumerType[] = [
  { name: "farmlands", label: "الأراضي الزراعية", value: 58, color: "#0D9E7E" },
  { name: "residential", label: "السكان", value: 27, color: "#1D6FA8" },
  { name: "industrial", label: "المصانع", value: 15, color: "#C8A96A" },
];

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ConsumerType }>;
}) => {
  if (active && payload?.[0]) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg">
        <p
          className="font-semibold text-gray-800"
          style={{ fontFamily: "Cairo" }}
        >
          {data.label}
        </p>
        <p className="text-gray-600" style={{ fontFamily: "Cairo" }}>
          {data.value}%
        </p>
      </div>
    );
  }
  return null;
};

export function ConsumerTypeChart() {
  const { targetRef, isVisible } = useIntersectionObserver();
  return (
    <div className="h-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-right text-sm font-semibold">
        توزيع الاستهلاك حسب نوع المستهلك
      </h3>

      <div className="flex flex-col items-center">
        {/* Donut Chart */}
        <div ref={targetRef} className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={isVisible ? CONSUMER_TYPES : []}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                startAngle={90}
                endAngle={-270}
                isAnimationActive={isVisible}
              >
                {CONSUMER_TYPES.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    stroke="transparent"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Center text */}
        <div className="-mt-[130px] mb-[90px] text-center">
          <p className="text-2xl font-bold text-gray-800">100%</p>
          <p className="text-xs text-gray-500">إجمالي</p>
        </div>

        {/* Legend */}
        <div className="mt-2 w-full space-y-2">
          {CONSUMER_TYPES.map((type) => (
            <div
              key={type.name}
              className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: type.color }}
                />
                <span className="text-sm text-gray-700">{type.label}</span>
              </div>
              <span className="text-sm font-semibold text-gray-800">
                {type.value}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
