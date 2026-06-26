import { type MetricRow } from "./use-well-metrics";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

interface ChartStatsBarProps {
  currentValue: number | null;
  unit: string;
  rows: MetricRow[];
}

export function ChartStatsBar({ currentValue, unit, rows }: ChartStatsBarProps) {
  if (!rows || rows.length === 0) return null;

  // Calculate delta
  const firstVal = rows[0]?.avg_value;
  const lastVal = rows[rows.length - 1]?.avg_value;
  
  let deltaPct = 0;
  let deltaAbs = 0;
  if (firstVal && lastVal) {
    deltaAbs = lastVal - firstVal;
    deltaPct = (deltaAbs / firstVal) * 100;
  }

  // Calculate overall min/max
  const minVal = Math.min(...rows.map(r => r.min_value ?? r.avg_value));
  const maxVal = Math.max(...rows.map(r => r.max_value ?? r.avg_value));



  return (
    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-gray-100 pt-4">
      {/* Current */}
      <div className="bg-gray-50/80 rounded-lg p-3">
        <div className="text-[11px] text-gray-500 mb-1">الحالي</div>
        <div className="text-sm font-bold text-gray-900">
          {currentValue !== null ? `${currentValue.toFixed(2)} ${unit}` : "—"}
        </div>
      </div>

      {/* Delta */}
      <div className="bg-gray-50/80 rounded-lg p-3">
        <div className="text-[11px] text-gray-500 mb-1">تغير الفترة</div>
        <div className={`text-sm font-bold flex items-center gap-1 ${
          deltaPct > 0 ? "text-red-600" : deltaPct < 0 ? "text-emerald-600" : "text-gray-600"
        }`}>
          {deltaPct > 0 ? <TrendingUp size={14} /> : deltaPct < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
          <span dir="ltr">
            {deltaPct > 0 ? "+" : ""}{deltaPct.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Min */}
      <div className="bg-gray-50/80 rounded-lg p-3">
        <div className="text-[11px] text-gray-500 mb-1">الحد الأدنى</div>
        <div className="text-sm font-bold text-gray-900">
          {isFinite(minVal) ? `${minVal.toFixed(2)} ${unit}` : "—"}
        </div>
      </div>

      {/* Max */}
      <div className="bg-gray-50/80 rounded-lg p-3">
        <div className="text-[11px] text-gray-500 mb-1">الحد الأقصى</div>
        <div className="text-sm font-bold text-gray-900">
          {isFinite(maxVal) ? `${maxVal.toFixed(2)} ${unit}` : "—"}
        </div>
      </div>
    </div>
  );
}
