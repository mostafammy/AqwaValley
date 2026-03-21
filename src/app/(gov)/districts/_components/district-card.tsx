import { WellStatusCard } from "./well-status-card";
import { Droplets, AlertTriangle, TrendingDown, Activity } from "lucide-react";

type Well = {
  id:         string;
  name:       string;
  status:     "active" | "inactive" | "maintenance" | "offline" | "restricted";
  levelPct:   number;
  flowRate:   number | null;
  alertCount: number;
};

type DistrictCardProps = {
  id:           string;
  name:         string;
  totalWells:   number;
  activeWells:  number;
  avgLevelPct:  number;
  alertCount:   number;
  depletionRate: number;
  wells:        Well[];
};

export function DistrictCard({
  name,
  totalWells,
  activeWells,
  avgLevelPct,
  alertCount,
  depletionRate,
  wells,
}: DistrictCardProps) {
  const riskColor =
    avgLevelPct < 30 ? "text-red-600" :
    avgLevelPct < 60 ? "text-amber-600" :
    "text-teal-600";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      {/* District Header */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">{name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {activeWells} نشط من أصل {totalWells} بئر
            </p>
          </div>
          {alertCount > 0 && (
            <span className="flex items-center gap-1 bg-red-50 text-red-600 text-xs font-bold px-3 py-1 rounded-full border border-red-200">
              <AlertTriangle className="h-3 w-3" />
              {alertCount} تنبيه نشط
            </span>
          )}
        </div>

        {/* District Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100/50">
            <div className="flex items-center gap-1.5 mb-1">
              <Droplets className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-[11px] text-blue-600 font-bold">إجمالي الآبار</span>
            </div>
            <span className="text-xl font-black text-blue-900">{totalWells}</span>
          </div>

          <div className="bg-teal-50/50 rounded-xl p-3 border border-teal-100/50">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity className="h-3.5 w-3.5 text-teal-500" />
              <span className="text-[11px] text-teal-600 font-bold">متوسط المنسوب</span>
            </div>
            <span className={`text-xl font-black ${riskColor}`}>
              {Math.round(avgLevelPct)}%
            </span>
          </div>

          <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100/50">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[11px] text-amber-600 font-bold">معدل الانخفاض</span>
            </div>
            <span className="text-xl font-black text-amber-900">
              {depletionRate} م/سنة
            </span>
          </div>

          <div className="bg-red-50/30 rounded-xl p-3 border border-red-100/30">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
              <span className="text-[11px] text-red-600 font-bold">التنبيهات</span>
            </div>
            <span className={`text-xl font-black ${alertCount > 0 ? "text-red-600" : "text-gray-400"}`}>
              {alertCount}
            </span>
          </div>
        </div>
      </div>

      {/* Wells Grid */}
      <div className="p-5">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          الآبار
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {wells.map((w) => (
            <WellStatusCard key={w.id} {...w} />
          ))}
        </div>
      </div>

    </div>
  );
}