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
    <div className="h-full rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-5">
      <h3 className="mb-3 text-right text-xs font-semibold sm:mb-4 sm:text-sm">
        توزيع الاستهلاك حسب نوع المستهلك
      </h3>

      <div className="flex flex-col items-center">
        {/* Donut Chart with center label */}
        <div ref={targetRef} className="relative h-[200px] w-full sm:h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={isVisible ? CONSUMER_TYPES : []}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
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
          {/* Center label - absolutely positioned to overlay donut center */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-lg font-bold text-gray-800 sm:text-2xl">100%</p>
            <p className="text-[10px] text-gray-500 sm:text-xs">إجمالي</p>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-3 w-full space-y-1.5 sm:mt-4 sm:space-y-2">
          {CONSUMER_TYPES.map((type) => (
            <div
              key={type.name}
              className="flex items-center justify-between rounded-lg bg-gray-50 px-2.5 py-1.5 sm:px-3 sm:py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <div
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: type.color }}
                />
                <span className="truncate text-xs text-gray-700 sm:text-sm">{type.label}</span>
              </div>
              <span className="shrink-0 text-xs font-semibold text-gray-800 sm:text-sm">
                {type.value}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
