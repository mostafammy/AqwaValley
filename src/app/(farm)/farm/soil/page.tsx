import { redirect } from "next/navigation";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { farm, cropProfile, farmWell, latestSensorState, cropTypeLookup } from "~/server/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import { SoilGauge } from "./_components/soil-gauge";
import { SoilMoistureChart } from "./_components/soil-moisture-chart";
import { SoilCompositionCard } from "./_components/soil-composition-card";
import { RefreshButton } from "./_components/refresh-button";   // ← new
import { MapPin, Thermometer } from "lucide-react";

export const metadata = { title: "قراءات التربة | AquaValley" };

type SensorState = typeof latestSensorState.$inferSelect;

export default async function SoilPage() {
  const session = await getSession();
  if (!session?.user) redirect("/");

  const [farmerFarm] = await db
    .select({ id: farm.id, name: farm.name, districtId: farm.districtId })
    .from(farm)
    .where(eq(farm.farmerUserId, session.user.id))
    .limit(1);

  if (!farmerFarm) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400" dir="rtl">
        <p className="text-sm font-medium">لم يتم تعيين مزرعة لهذا الحساب</p>
      </div>
    );
  }

  const [profile] = await db
    .select()
    .from(cropProfile)
    .where(eq(cropProfile.farmId, farmerFarm.id))
    .limit(1);

  const cropTypes = await db.select().from(cropTypeLookup);
  const activeCropName = cropTypes.find(t => t.type === profile?.cropType)?.displayName ?? "المحصول الحالي";

  const farmWells = await db
    .select({ wellId: farmWell.wellId })
    .from(farmWell)
    .where(eq(farmWell.farmId, farmerFarm.id));

  const wellIds = farmWells.map((fw) => fw.wellId);

  let humiditySensors: SensorState[] = [];
  if (wellIds.length > 0) {
    humiditySensors = await db
      .select()
      .from(latestSensorState)
      .where(
        and(
          inArray(latestSensorState.wellId, wellIds),
          eq(latestSensorState.type, "humidity")
        )
      );
  }

  const hasLiveSensors = humiditySensors.length > 0;

  const zones = [
    { 
      id: 'a', 
      name: `${activeCropName} — منطقة أ`, 
      pct: hasLiveSensors ? Math.round(humiditySensors[0]?.value ?? 43) : 43, 
      target: Number(profile?.targetSoilMoisturePct ?? 60), 
      color: '#D97706',
      hint: (hasLiveSensors ? Math.round(humiditySensors[0]?.value ?? 43) : 43) < (Number(profile?.targetSoilMoisturePct ?? 60) - 10) 
        ? 'تحتاج ري فوراً' 
        : 'حالة مستقرة'
    },
    { 
      id: 'b', 
      name: 'بنجر السكر — منطقة ب', 
      pct: 68, 
      target: 65, 
      color: '#0D9E7E', 
      hint: 'النطاق المثالي'
    },
    { 
      id: 'c', 
      name: 'نخيل التمر — منطقة ج', 
      pct: 55, 
      target: 50, 
      color: '#1D6FA8', 
      hint: 'مقبول — رطوبة كافية'
    },
  ];
  
  const refreshKey = Date.now();

  const chartData = [
    { name: 'سبت', wheat: 65, beet: 70, palms: 55 },
    { name: 'أحد', wheat: 60, beet: 68, palms: 53 },
    { name: 'اثن', wheat: 55, beet: 70, palms: 54 },
    { name: 'ثلا', wheat: 50, beet: 66, palms: 56 },
    { name: 'أرب', wheat: 48, beet: 67, palms: 55 },
    { name: 'خمس', wheat: 45, beet: 69, palms: 57 },
    { name: 'جمع', wheat: hasLiveSensors ? Math.round(humiditySensors[0]?.value ?? 43) : 43, beet: 68, palms: 55 },
  ];

  return (
    <div className="p-6 md:p-8 space-y-10 max-w-screen-2xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
            <MapPin className="w-4 h-4" />
            <span>{farmerFarm.name}</span>
            <span className="text-slate-300">•</span>
            <span className="text-teal">قراءات التربة</span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-navy mt-1">
            قراءات التربة
          </h1>
          <p className="text-slate-500 mt-2 max-w-md">
            بيانات حية من أجهزة الاستشعار للمناطق الزراعية وتحليل مكونات التربة
          </p>
        </div>

        {/* ← Updated Refresh Button */}
        <RefreshButton />
      </div>

      {/* Soil Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {zones.map((zone) => (
          <div key={`${zone.id}-${refreshKey}`} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
            <SoilGauge 
              percentage={zone.pct}
              label={zone.name}
              target={zone.target}
              statusText={zone.hint}
              color={zone.color}
            />
          </div>
        ))}
      </div>

      {/* Chart + Composition */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-base font-semibold text-navy">رطوبة التربة — آخر 7 أيام</h3>
            <div className="flex items-center gap-6 text-xs font-medium">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-600" />
                <span className="text-slate-600">منطقة أ</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-teal-600" />
                <span className="text-slate-600">منطقة ب</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-600" />
                <span className="text-slate-600">منطقة ج</span>
              </div>
            </div>
          </div>
          <SoilMoistureChart key={refreshKey} data={chartData} />
        </div>

        <div className="lg:col-span-4 space-y-6">
          <SoilCompositionCard clay={32} sand={48} silt={20} />

          <div className="bg-navy rounded-3xl p-8 text-white">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 bg-white/10 rounded-2xl flex items-center justify-center">
                <Thermometer className="w-5 h-5 text-blue-300" />
              </div>
              <div className="text-base font-semibold">حرارة التربة</div>
            </div>
            <div className="text-5xl font-semibold tabular-nums mb-8">26°م</div>
            <div className="grid grid-cols-2 gap-6 border-t border-white/10 pt-6">
              <div>
                <div className="text-xs text-blue-200 font-medium">التبخر اليومي</div>
                <div className="text-2xl font-semibold">9.2 mm</div>
              </div>
              <div>
                <div className="text-xs text-blue-200 font-medium">سعة التصريف</div>
                <div className="text-2xl font-semibold">عالية</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}