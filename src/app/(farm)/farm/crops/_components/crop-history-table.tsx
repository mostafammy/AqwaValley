import { db } from "~/server/db";
import { cropHistory } from "~/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { Leaf } from "lucide-react";

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
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 md:px-8 md:py-5">
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
        <div className="overflow-x-auto">
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
                    {row.plantedDate
                      ? new Date(row.plantedDate).toLocaleDateString("ar-EG")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 md:px-8 md:py-5">
                    {row.harvestedDate
                      ? new Date(row.harvestedDate).toLocaleDateString("ar-EG")
                      : "—"}
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
      )}
    </div>
  );
}
