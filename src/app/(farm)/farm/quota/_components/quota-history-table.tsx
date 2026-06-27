"use client";

import { motion } from "framer-motion";
import { ClipboardList } from "lucide-react";
import { springs } from "~/lib/motion";

type QuotaHistoryItem = {
  periodStart: string | Date;
  quotaM3: string | number;
  consumptionM3: string | number;
  effectiveState: string;
};

type QuotaHistoryTableProps = {
  history: QuotaHistoryItem[];
};

export function QuotaHistoryTable({ history }: QuotaHistoryTableProps) {
  // Sort history by date descending, handling NaN dates
  const sortedHistory = [...history].sort((a, b) => {
    const aTime = new Date(a.periodStart).getTime();
    const bTime = new Date(b.periodStart).getTime();
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  });

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-5">
      <div className="mb-4 flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <div className="flex min-w-0 items-center gap-2 text-base font-bold break-words text-gray-800">
          <ClipboardList className="h-5 w-5 shrink-0 text-blue-500" />
          تفصيل الحصة السنوية
        </div>
      </div>
      <div
        className="flex-1 overflow-x-auto overflow-y-auto pr-1 custom-scrollbar"
        style={{ maxHeight: "350px" }}
      >
        <table className="w-full min-w-180 border-collapse text-right text-sm">
          <thead className="glass-header sticky top-0 z-10">
            <tr className="border-b border-gray-100 text-gray-400">
              <th className="bg-white pb-3 pr-2 font-medium">الشهر</th>
              <th className="bg-white pb-3 pr-2 font-medium">الحصة</th>
              <th className="bg-white pb-3 pr-2 font-medium">الاستهلاك</th>
              <th className="bg-white pb-3 pr-2 font-medium">الفرق</th>
              <th className="bg-white pb-3 pr-2 font-medium">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sortedHistory.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-400">
                  لا توجد بيانات تاريخية متاحة
                </td>
              </tr>
            ) : (
              sortedHistory.map((item, index) => {
                const rawConsumption = Number(item.consumptionM3);
                const rawQuota = Number(item.quotaM3);
                const consumption = Number.isFinite(rawConsumption) ? rawConsumption : 0;
                const quota = Number.isFinite(rawQuota) ? rawQuota : 0;
                const diff = quota - consumption;
                const dateObj = new Date(item.periodStart);
                const monthName = Number.isNaN(dateObj.getTime())
                  ? "—"
                  : dateObj.toLocaleDateString("ar-EG", {
                      month: "long",
                      year: "numeric",
                    });

                const isOver = consumption > quota;
                const state = item.effectiveState;

                return (
                  <motion.tr
                    key={index}
                    className="table-row-hover hover:bg-gray-50/50"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springs.floaty, delay: index * 0.04 }}
                  >
                    <td className="py-4 pr-2 font-semibold whitespace-nowrap text-gray-700">
                      {monthName}
                    </td>
                    <td className="py-4 pr-2 whitespace-nowrap text-gray-600">
                      {quota.toLocaleString("ar-EG")} <span className="text-xs">م³</span>
                    </td>
                    <td className="py-4 pr-2 font-bold whitespace-nowrap text-gray-800">
                      {consumption.toLocaleString("ar-EG")} <span className="text-xs">م³</span>
                    </td>
                    <td className={`py-4 pr-2 font-medium whitespace-nowrap ${isOver ? "text-red-500" : "text-emerald-600"}`}>
                      {isOver ? "+" : "-"}
                      {Math.abs(diff).toLocaleString("ar-EG")} <span className="text-xs">م³</span>
                    </td>
                    <td className="py-4 pr-2">
                       <span
                        className={`badge ${
                          isOver
                            ? "badge-danger"
                            : state === "warning"
                              ? "badge-warn"
                              : "badge-ok"
                        } badge-animate`}
                      >
                        <span className="badge-dot" />
                        {isOver ? "تجاوز" : "ضمن الحصة"}
                      </span>
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
