import { redirect } from "next/navigation";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import {
  farm,
  cropProfile,
  farmWell,
  cropTypeLookup,
  userRoleAssignment,
  role,
} from "~/server/db/schema";
import { eq, or } from "drizzle-orm";
import { SoilGauge } from "./_components/soil-gauge";
import { SoilMoistureChart, type SoilChartSeries, type SoilChartPoint } from "./_components/soil-moisture-chart";
import { SoilCompositionCard } from "./_components/soil-composition-card";
import { RefreshButton } from "./_components/refresh-button";
import { MapPin, Thermometer } from "lucide-react";
import { SignOutButton } from "~/app/_components/auth/SignOutButton";
import { SoilDataRepository } from "~/server/repositories/soil-data.repository";

export const metadata = { title: "قراءات التربة | AquaValley" };

async function hasAdminOrManagerRole(userId: string): Promise<boolean> {
  const userRoles = await db
    .select({ type: role.type })
    .from(userRoleAssignment)
    .innerJoin(role, eq(userRoleAssignment.roleId, role.id))
    .where(eq(userRoleAssignment.userId, userId));

  const roleTypes = userRoles.map((r) => r.type);
  return roleTypes.includes("admin") || roleTypes.includes("district_manager");
}

const ZONE_COLORS = ["#D97706", "#0D9E7E", "#1D6FA8", "#9333EA", "#E11D48"];

export default async function SoilPage() {
  const session = await getSession();
  if (!session?.user) redirect("/");

  const [farmerFarm] = await db
    .select({ id: farm.id, name: farm.name, districtId: farm.districtId })
    .from(farm)
    .where(
      or(
        eq(farm.farmerUserId, session.user.id),
        eq(farm.ownerId, session.user.id),
      ),
    )
    .limit(1);

  let currentFarm = farmerFarm;

  if (!currentFarm && process.env.NODE_ENV === "development") {
    const isAdminOrManager = await hasAdminOrManagerRole(session.user.id);
    if (isAdminOrManager && process.env.DEV_ALLOW_FALLBACK === "true") {
      const [fallbackFarm] = await db
        .select({ id: farm.id, name: farm.name, districtId: farm.districtId })
        .from(farm)
        .limit(1);
      currentFarm = fallbackFarm;
    }
  }

  if (!currentFarm) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="mb-4 text-6xl">🚫</div>
          <h2 className="mb-2 text-xl font-bold text-gray-800">
            لا توجد مزرعة مرتبطة بحسابك
          </h2>
          <p className="mb-6 text-gray-600">
            يرجى التواصل مع مسؤول النظام لتخصيص مزرعة لحسابك، أو تحقق من بيانات
            اعتماد تسجيل الدخول الخاصة بك.
          </p>
          <SignOutButton className="inline-block rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700">
            العودة للرئيسية وتسجيل الخروج
          </SignOutButton>
        </div>
      </div>
    );
  }

  const [profile] = await db
    .select()
    .from(cropProfile)
    .where(eq(cropProfile.farmId, currentFarm.id))
    .limit(1);

  const cropTypes = await db.select().from(cropTypeLookup);
  const activeCropName =
    cropTypes.find((t) => t.type === profile?.cropType)?.displayName ??
    "المحصول الحالي";

  const farmWells = await db
    .select({ wellId: farmWell.wellId })
    .from(farmWell)
    .where(eq(farmWell.farmId, currentFarm.id));

  const wellIds = farmWells.map((fw) => fw.wellId);

  // Use Repository Pattern to fetch all real sensor data
  const repo = new SoilDataRepository();
  const [humidityReadings, temperatureReadings, humidityHistory] = await Promise.all([
    repo.getLatestHumidityByWells(wellIds),
    repo.getLatestTemperatureByWells(wellIds),
    repo.getHumidityHistory7d(wellIds),
  ]);

  const targetMoisture = Number(profile?.targetSoilMoisturePct ?? 60);

  // Dynamic zones based on actual well sensors
  const zones = humidityReadings.map((r, i) => {
    const pctValue = Math.round(r.value);
    const color = ZONE_COLORS[i % ZONE_COLORS.length];
    return {
      id: r.wellId,
      name: `${activeCropName} — ${r.wellName}`,
      pct: pctValue,
      target: targetMoisture,
      color: color,
      hint: pctValue < targetMoisture - 10 ? "تحتاج ري فوراً" : "حالة مستقرة",
    };
  });

  // Prepare generic chart series
  const chartSeries: SoilChartSeries[] = humidityReadings.map((r, i) => ({
    wellId: r.wellId,
    wellName: r.wellName,
    color: ZONE_COLORS[i % ZONE_COLORS.length]!,
  }));

  // Pivot historical data by time bucket
  const pointsByDate = new Map<string, SoilChartPoint>();
  for (const point of humidityHistory) {
    // Label by short weekday
    const dateLabel = new Date(point.bucket).toLocaleDateString("ar-EG", { weekday: "short" });
    if (!pointsByDate.has(dateLabel)) {
      pointsByDate.set(dateLabel, { label: dateLabel });
    }
    const currentPoint = pointsByDate.get(dateLabel)!;
    currentPoint[point.wellId] = point.avgValue;
  }
  const chartData = Array.from(pointsByDate.values());

  const soilTempC = temperatureReadings[0]?.value;

  const refreshKey = Date.now();

  return (
    <div className="mx-auto max-w-screen-2xl space-y-10 p-6 md:p-8" dir="rtl">
      {/* Header */}
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
            <MapPin className="h-4 w-4" />
            <span>{currentFarm.name}</span>
            <span className="text-slate-300">•</span>
            <span className="text-teal">قراءات التربة</span>
          </div>
          <h1 className="text-navy mt-1 text-4xl font-semibold tracking-tight">
            قراءات التربة
          </h1>
          <p className="mt-2 max-w-md text-slate-500">
            بيانات حية من أجهزة الاستشعار للمناطق الزراعية وتحليل مكونات التربة
          </p>
        </div>

        <RefreshButton />
      </div>

      {/* Soil Gauges */}
      {zones.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center text-slate-500">
          لا توجد مستشعرات رطوبة مسجلة لهذه المزرعة حالياً.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {zones.map((zone) => (
            <div
              key={`${zone.id}-${refreshKey}`}
              className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"
            >
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
      )}

      {/* Chart + Composition */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm lg:col-span-8">
          <div className="mb-8 flex items-center justify-between">
            <h3 className="text-navy text-base font-semibold">
              رطوبة التربة — آخر 7 أيام
            </h3>
            <div className="flex items-center gap-6 text-xs font-medium">
              {chartSeries.map((s) => (
                <div key={s.wellId} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-slate-600 truncate max-w-[150px]">{s.wellName}</span>
                </div>
              ))}
            </div>
          </div>
          <SoilMoistureChart key={refreshKey} data={chartData} series={chartSeries} />
        </div>

        <div className="space-y-6 lg:col-span-4">
          <SoilCompositionCard clay={32} sand={48} silt={20} />

          <div className="bg-navy rounded-3xl p-8 text-white">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10">
                <Thermometer className="h-5 w-5 text-blue-300" />
              </div>
              <div className="text-base font-semibold">حرارة التربة</div>
            </div>
            
            <div className="mb-8 text-5xl font-semibold tabular-nums">
              {soilTempC !== undefined ? `${soilTempC.toFixed(1)}°م` : "—"}
            </div>
            <div className="grid grid-cols-2 gap-6 border-t border-white/10 pt-6">
              <div>
                <div className="text-xs font-medium text-blue-200">
                  التبخر اليومي
                </div>
                <div className="text-2xl font-semibold">غير متوفر</div>
              </div>
              <div>
                <div className="text-xs font-medium text-blue-200">
                  سعة التصريف
                </div>
                <div className="text-2xl font-semibold">غير متوفر</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
