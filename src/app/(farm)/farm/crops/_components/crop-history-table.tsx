import { db } from "~/server/db";
import { cropHistory } from "~/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { Calendar, Leaf, Sprout } from "lucide-react";

type CropTypeEntity = {
  id: string;
  type: string;
  displayName: string;
  commonName?: string | null;
  description: string | null;
};

type GrowthStageEntity = {
  id: string;
  stage: string;
  displayName: string;
  description: string | null;
  estDurationDays: number | null;
};

interface CropHistoryTableProps {
  farmId: string;
  cropTypes: CropTypeEntity[];
  growthStages: GrowthStageEntity[];
}

function formatDate(value: Date | string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ar-EG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export async function CropHistoryTable({
  farmId,
  cropTypes,
  growthStages,
}: CropHistoryTableProps) {
  const history = await db
    .select()
    .from(cropHistory)
    .where(eq(cropHistory.farmId, farmId))
    .orderBy(desc(cropHistory.recordedAt))
    .limit(10);

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 md:px-8 md:py-5">
        <h3 className="text-navy text-base font-semibold">
          سجل المحاصيل السابقة
        </h3>
        <span className="text-xs font-medium text-slate-400">آخر 10 سجلات</span>
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
            <Leaf className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium">لا يوجد سجل محاصيل بعد</p>
        </div>
      ) : (
        <>
          {/* Mobile: card layout */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {history.map((row) => {
              const cropName =
                cropTypes.find((t) => t.type === row.cropType)
                  ?.displayName ?? row.cropType;
              const stageName =
                growthStages.find((s) => s.stage === row.growthStage)
                  ?.displayName ?? row.growthStage;
              return (
                <li key={row.id} className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-teal-50">
                        <Sprout className="h-4 w-4 text-teal-600" />
                      </div>
                      <span className="text-navy truncate text-sm font-semibold">
                        {cropName}
                      </span>
                    </div>
                    {row.yield ? (
                      <span className="shrink-0 text-sm font-bold text-teal-600 tabular-nums">
                        {Number(row.yield).toLocaleString("ar-EG")}{" "}
                        <span className="text-[10px] font-medium text-slate-400">
                          {row.yieldUnit ?? ""}
                        </span>
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                      {stageName}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      زراعة: {formatDate(row.plantedDate)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      حصاد: {formatDate(row.harvestedDate)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Desktop: table layout */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-4 text-right text-xs font-medium text-slate-500 md:px-8">
                    المحصول
                  </th>
                  <th className="px-4 py-4 text-right text-xs font-medium text-slate-500 md:px-8">
                    المرحلة
                  </th>
                  <th className="px-4 py-4 text-right text-xs font-medium text-slate-500 md:px-8">
                    تاريخ الزراعة
                  </th>
                  <th className="px-4 py-4 text-right text-xs font-medium text-slate-500 md:px-8">
                    تاريخ الحصاد
                  </th>
                  <th className="px-4 py-4 text-right text-xs font-medium text-slate-500 md:px-8">
                    الإنتاجية
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((row) => (
                  <tr
                    key={row.id}
                    className="transition-colors hover:bg-slate-50"
                  >
                    <td className="text-navy px-4 py-3 text-sm font-medium md:px-8 md:py-5">
                      {cropTypes.find((t) => t.type === row.cropType)
                        ?.displayName ?? row.cropType}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 md:px-8 md:py-5">
                      {growthStages.find((s) => s.stage === row.growthStage)
                        ?.displayName ?? row.growthStage}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 md:px-8 md:py-5">
                      {formatDate(row.plantedDate)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 md:px-8 md:py-5">
                      {formatDate(row.harvestedDate)}
                    </td>
                    <td className="px-4 py-3 text-sm md:px-8 md:py-5">
                      {row.yield ? (
                        <span className="font-medium text-teal-600">
                          {Number(row.yield).toLocaleString("ar-EG")}{" "}
                          {row.yieldUnit ?? ""}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
