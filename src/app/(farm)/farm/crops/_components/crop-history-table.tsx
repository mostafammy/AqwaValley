import { db } from "~/server/db";
import { cropHistory } from "~/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { Leaf } from "lucide-react";

type LookupEntity = {
  id: string;
  type?: string;
  stage?: string;
  displayName: string;
  commonName: string | null;
  description: string | null;
};

interface CropHistoryTableProps {
  farmId: string;
  cropTypes: LookupEntity[];
  growthStages: LookupEntity[];
}

export async function CropHistoryTable({ 
  farmId, 
  cropTypes, 
  growthStages 
}: CropHistoryTableProps) {
  const history = await db
    .select()
    .from(cropHistory)
    .where(eq(cropHistory.farmId, farmId))
    .orderBy(desc(cropHistory.recordedAt))
    .limit(10);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-base font-semibold text-navy">سجل المحاصيل السابقة</h3>
        <span className="text-xs font-medium text-slate-400">آخر 10 سجلات</span>
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
            <Leaf className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium">لا يوجد سجل محاصيل بعد</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-8 py-4 text-right text-xs font-medium text-slate-500">المحصول</th>
                <th className="px-8 py-4 text-right text-xs font-medium text-slate-500">المرحلة</th>
                <th className="px-8 py-4 text-right text-xs font-medium text-slate-500">تاريخ الزراعة</th>
                <th className="px-8 py-4 text-right text-xs font-medium text-slate-500">تاريخ الحصاد</th>
                <th className="px-8 py-4 text-right text-xs font-medium text-slate-500">الإنتاجية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-8 py-5 text-sm font-medium text-navy">
                    {cropTypes.find(t => t.type === row.cropType)?.displayName ?? row.cropType}
                  </td>
                  <td className="px-8 py-5 text-sm text-slate-600">
                    {growthStages.find(s => s.stage === row.growthStage)?.displayName ?? row.growthStage}
                  </td>
                  <td className="px-8 py-5 text-sm text-slate-500">
                    {row.plantedDate
                      ? new Date(row.plantedDate).toLocaleDateString("ar-EG")
                      : "—"}
                  </td>
                  <td className="px-8 py-5 text-sm text-slate-500">
                    {row.harvestedDate
                      ? new Date(row.harvestedDate).toLocaleDateString("ar-EG")
                      : "—"}
                  </td>
                  <td className="px-8 py-5 text-sm">
                    {row.yield ? (
                      <span className="text-teal-600 font-medium">
                        {Number(row.yield).toLocaleString("ar-EG")} {row.yieldUnit ?? ""}
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