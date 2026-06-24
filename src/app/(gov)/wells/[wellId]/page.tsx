import { notFound } from "next/navigation";
import { db } from "~/server/db";
import { well, district, sensors, sensorData } from "~/server/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { WaterDropGauge } from "./_components/water-drop-gauge";
import { ReadingsChart }  from "./_components/readings-chart";
import { WellAlerts }     from "./_components/well-alerts";
import { Suspense }       from "react";
import { Skeleton }       from "~/app/_components/UI/Skeleton";
import { Badge } from "~/app/_components/UI/Badge";
import { wellStatusLabel, wellStatusVariant } from "~/lib/utils";
import { MapPin, Building2, Ruler, Droplets, Settings } from "lucide-react";

async function getWellDetail(wellId: string) {
  const [row] = await db
    .select({
      id:           well.id,
      name:         well.name,
      status:       well.status,
      levelPct:     well.currentLevelPct,
      depthM:       well.depthM,
      flowRate:     well.baselineFlowRateM3Hr,
      valveState:   well.valveState,
      lat:          well.latitude,
      lng:          well.longitude,
      districtName: district.name,
    })
    .from(well)
    .leftJoin(district, eq(district.id, well.districtId))
    .where(eq(well.id, wellId))
    .limit(1);

  if (!row) return null;

  // Get water_level sensor readings
  const [levelSensor] = await db
    .select({ id: sensors.id })
    .from(sensors)
    .where(
      and(
        eq(sensors.wellId, wellId),
        eq(sensors.type, "water_level"),
      )
    )
    .limit(1);

  let readings: { timestamp: string; value: number }[] = [];

  if (levelSensor) {
    const rawReadings = await db
      .select({
        timestamp: sensorData.timestamp,
        value:     sensorData.value,
      })
      .from(sensorData)
      .where(eq(sensorData.sensorId, levelSensor.id))
      .orderBy(desc(sensorData.timestamp))
      .limit(500);

    readings = rawReadings.map((r) => ({
      timestamp: r.timestamp.toISOString(),
      value:     r.value,
    })).reverse();
  }

  // Fetch thresholds
  const alertRules = await db.query.alertRule.findMany({
    where: (rules, { and, eq }) => and(eq(rules.wellId, wellId), eq(rules.sensorType, "water_level"))
  });

  const thresholds: { min?: number, max?: number } = {};
  for (const rule of alertRules) {
    if (rule.operator === "lt" || rule.operator === "lte") {
      thresholds.min = rule.threshold;
    } else if (rule.operator === "gt" || rule.operator === "gte") {
      thresholds.max = rule.threshold;
    }
  }

  return { ...row, readings, thresholds };
}

export default async function WellDetailPage({
  params,
}: {
  params: Promise<{ wellId: string }>;
}) {
  const { wellId } = await params;
  const data = await getWellDetail(wellId);
  if (!data) notFound();

  const levelPct = Number(data.levelPct ?? 0);

  return (
    <div
      className="p-4 md:p-6 space-y-6"
      dir="rtl"
      style={{ animation: "fadeSlideUp 0.4s ease-out both" }}
    >
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
          <a href="/districts" className="flex items-center gap-1 hover:text-blue-500 transition-colors group">
            <span className="group-hover:-translate-x-1 transition-transform">←</span>
            <span>العودة للمراكز</span>
          </a>
          <span>›</span>
          <span>{data.districtName}</span>
          <span>›</span>
          <span className="text-gray-600 font-medium">{data.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">{data.name}</h1>
            <p className="text-sm text-gray-500 mt-1">{data.districtName}</p>
          </div>
          <Badge variant={wellStatusVariant(data.status)} dot className="px-4 py-1.5 text-sm">
            {wellStatusLabel(data.status)}
          </Badge>
        </div>
      </div>

      {/* Gauge + Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Water Drop Gauge */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col items-center justify-center">
          <WaterDropGauge levelPct={levelPct} size={160} />
          <p className="text-xs text-gray-400 mt-3 font-medium">منسوب المياه الحالي</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{levelPct}%</p>
        </div>

        {/* Well Info */}
        <div className="md:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold mb-4">بيانات البئر الفنية</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: "عمق البئر",    value: `${data.depthM ?? "—"} متر`,                       icon: <Ruler size={16} /> },
              { label: "معدل التدفق",  value: data.flowRate ? `${data.flowRate} م³/ساعة` : "—", icon: <Droplets size={16} /> },
              { label: "حالة الصمام",  value: data.valveState === "open" ? "مفتوح" : data.valveState === "closed" ? "مغلق" : (data.valveState ?? "—"), icon: <Settings size={16} /> },
              { label: "خط العرض",     value: data.lat != null ? `${Number(data.lat).toFixed(4)}° شمالاً` : "—", icon: <MapPin size={16} /> },
              { label: "خط الطول",     value: data.lng != null ? `${Number(data.lng).toFixed(4)}° شرقاً` : "—",  icon: <MapPin size={16} /> },              { label: "المركز الإداري", value: data.districtName ?? "—",                        icon: <Building2 size={16} /> },
            ].map((item) => (
              <div key={item.label} className="bg-gray-50/80 rounded-xl p-3 border border-gray-100/50">
                <div className="text-[11px] text-gray-400 mb-1 flex items-center gap-1.5">
                  <span className="grayscale opacity-70">{item.icon}</span>
                  {item.label}
                </div>
                <div className="text-sm font-bold text-gray-700">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Readings Chart */}
      <ReadingsChart 
        wellId={data.id} 
        depthM={data.depthM ? Number(data.depthM) : null}
        currentValue={levelPct}
        thresholds={data.thresholds}
      />

      {/* Alerts */}
      <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
        <WellAlerts wellId={data.id} />
      </Suspense>

    </div>
  );
}