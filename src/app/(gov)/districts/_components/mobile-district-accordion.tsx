"use client";

import { type Dispatch, type SetStateAction } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, MapPin, AlertTriangle, Droplets, Activity, TrendingDown } from "lucide-react";
import { cn } from "~/lib/utils";
import { type DistrictWithWells } from "./districts-client";

interface MobileDistrictAccordionProps {
  districts: DistrictWithWells[];
  selectedId: string;
  onSelect: Dispatch<SetStateAction<string>>;
  onExpandWell: (id: string) => void;
}

const STATUS_COLORS = {
  active: "#34C759",
  maintenance: "#FF9500",
  restricted: "#FF9500",
  offline: "#FF3B30",
  inactive: "#94A3B8",
};

function getStatusCounts(wells: DistrictWithWells["wells"]) {
  let activeCount = 0;
  let warningCount = 0;
  let offlineCount = 0;
  let disabledCount = 0;
  for (const w of wells) {
    if (w.status === "active") activeCount++;
    else if (w.status === "offline") offlineCount++;
    else if (w.status === "inactive") disabledCount++;
    else warningCount++;
  }
  return { activeCount, warningCount, offlineCount, disabledCount };
}

function CompactWellCard({
  well,
  onClick,
}: {
  well: DistrictWithWells["wells"][number];
  onClick: () => void;
}) {
  const statusColor = STATUS_COLORS[well.status] ?? "#94A3B8";
  const numMatch = /\d+/.exec(well.name);
  const wellLabel = numMatch ? numMatch[0].padStart(2, "0") : well.name.slice(0, 2);

  return (
    <button
      onClick={onClick}
      type="button"
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl border border-[rgba(0,0,0,0.06)] bg-white p-2.5 text-right transition-all hover:bg-gray-50 active:scale-[0.98]",
        well.status === "offline" && "border-red-200 bg-red-50/30",
      )}
    >
      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg">
        <div
          className="absolute inset-0"
          style={{ backgroundColor: `${statusColor}15` }}
        />
        <div className="relative flex h-full w-full items-center justify-center">
          <span
            className="text-base font-extrabold leading-none tracking-tight"
            style={{ color: statusColor }}
          >
            {wellLabel}
          </span>
        </div>
        <div
          className="absolute top-0 right-0 h-full w-0.5"
          style={{ backgroundColor: statusColor }}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-bold text-[#1C1C1E]">{well.name}</span>
          {well.alertCount > 0 && (
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
              {well.alertCount}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium text-[#8E8E93]">
          <Droplets className="h-2.5 w-2.5" />
          <span className="tabular-nums">{Math.round(well.levelPct)}%</span>
          {well.flowRate != null && (
            <>
              <span className="h-1 w-1 rounded-full bg-gray-300" />
              <Activity className="h-2.5 w-2.5" />
              <span className="tabular-nums">{well.flowRate} م³/س</span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

function DistrictAccordionItem({
  district,
  isOpen,
  onToggle,
  onExpandWell,
}: {
  district: DistrictWithWells;
  isOpen: boolean;
  onToggle: () => void;
  onExpandWell: (id: string) => void;
}) {
  const { activeCount, warningCount, offlineCount, disabledCount } = getStatusCounts(district.wells);
  const total = district.totalWells || 1;
  const activePct = (activeCount / total) * 100;
  const warningPct = (warningCount / total) * 100;
  const offlinePct = (offlineCount / total) * 100;
  const disabledPct = (disabledCount / total) * 100;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-white transition-colors",
        isOpen
          ? "border-[var(--color-blue,#1D6FA8)] shadow-[0_4px_12px_rgba(29,111,168,0.06)]"
          : "border-[rgba(0,0,0,0.06)]",
      )}
    >
      <button
        onClick={onToggle}
        type="button"
        className="flex w-full items-center justify-between gap-2 p-3 text-right"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all",
              isOpen
                ? "bg-blue-50 text-[var(--color-blue,#1D6FA8)]"
                : "bg-gray-50 text-[#8E8E93] border border-gray-100",
            )}
          >
            <MapPin size={18} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "truncate text-sm font-bold transition-colors",
                  isOpen ? "text-[var(--color-blue,#1D6FA8)]" : "text-[#1C1C1E]",
                )}
              >
                {district.name}
              </span>
              {district.alertCount > 0 && (
                <span
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold",
                    offlineCount > 0
                      ? "border-red-200 bg-red-50 text-red-600"
                      : "border-amber-200 bg-amber-50 text-amber-600",
                  )}
                >
                  <AlertTriangle size={9} strokeWidth={3} />
                  {district.alertCount}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[10px] font-medium text-[#8E8E93]">
              <span>{district.totalWells} بئر</span>
              <span className="h-1 w-1 rounded-full bg-gray-300" />
              <span>{activeCount} نشط</span>
              {offlineCount > 0 && (
                <>
                  <span className="h-1 w-1 rounded-full bg-gray-300" />
                  <span className="text-red-500">{offlineCount} متوقف</span>
                </>
              )}
            </div>
          </div>
        </div>

        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="shrink-0 text-[#8E8E93]"
        >
          <ChevronDown size={18} />
        </motion.div>
      </button>

      {/* Status bar always visible */}
      <div className="mx-3 mb-3 flex h-1 gap-[2px] overflow-hidden rounded-full bg-[rgba(0,0,0,0.06)]">
        {activePct > 0 && (
          <div
            className="h-full"
            style={{
              width: `${activePct}%`,
              background: "linear-gradient(to bottom, #10B981, #059669)",
            }}
          />
        )}
        {warningPct > 0 && (
          <div
            className="h-full"
            style={{
              width: `${warningPct}%`,
              background: "linear-gradient(to bottom, #F59E0B, #D97706)",
            }}
          />
        )}
        {offlinePct > 0 && (
          <div
            className="h-full"
            style={{
              width: `${offlinePct}%`,
              background: "linear-gradient(to bottom, #EF4444, #DC2626)",
            }}
          />
        )}
        {disabledPct > 0 && (
          <div
            className="h-full"
            style={{
              width: `${disabledPct}%`,
              background: "linear-gradient(to bottom, #94A3B8, #64748B)",
            }}
          />
        )}
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden border-t border-[rgba(0,0,0,0.05)]"
          >
            <div className="space-y-3 p-3">
              {/* Mini district summary */}
              <div className="flex items-center justify-between rounded-xl bg-[rgba(0,0,0,0.02)] px-3 py-2">
                <div className="flex flex-col items-center">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#64748B]">
                    متوسط المنسوب
                  </span>
                  <span className="text-base font-bold text-[#1C1C1E] tabular-nums">
                    {Math.round(district.avgLevelPct)}%
                  </span>
                </div>
                <div className="h-6 w-px bg-[rgba(0,0,0,0.08)]" />
                <div className="flex flex-col items-center">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#64748B]">
                    معدل الانخفاض
                  </span>
                  <span className="text-base font-bold text-[#1C1C1E] tabular-nums">
                    {district.depletionRate}
                    <span className="mr-0.5 text-[9px] font-medium text-[#64748B]">م/سنة</span>
                  </span>
                </div>
                <div className="h-6 w-px bg-[rgba(0,0,0,0.08)]" />
                <div className="flex flex-col items-center">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#64748B]">
                    تنبيهات
                  </span>
                  <span className="text-base font-bold text-[#1C1C1E] tabular-nums">
                    {district.alertCount}
                  </span>
                </div>
              </div>

              {/* Wells grid */}
              {district.wells.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-xs text-[#8E8E93]">
                  لا توجد آبار في هذا المركز
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 xs:grid-cols-2">
                  {district.wells.map((well) => (
                    <CompactWellCard
                      key={well.id}
                      well={well}
                      onClick={() => onExpandWell(well.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MobileDistrictAccordion({
  districts,
  selectedId,
  onSelect,
  onExpandWell,
}: MobileDistrictAccordionProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {districts.map((d) => (
        <DistrictAccordionItem
          key={d.dbId}
          district={d}
          isOpen={d.dbId === selectedId}
          onToggle={() => onSelect(d.dbId)}
          onExpandWell={onExpandWell}
        />
      ))}
    </div>
  );
}