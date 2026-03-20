import { db } from "~/server/db";
import { well, alerts, sensorData, sensors } from "~/server/db/schema";
import { eq, count, and, isNull, avg, sum, sql, gte } from "drizzle-orm";
import { Droplets, AlertTriangle, Activity, TrendingDown } from "lucide-react";

async function getKpiData() {
  const [totalWells] = await db
    .select({ count: count() })
    .from(well)
    .where(eq(well.status, "active"));

  const [criticalAlerts] = await db
    .select({ count: count() })
    .from(alerts)
    .where(
      and(
        eq(alerts.severity, "critical"),
        isNull(alerts.acknowledgedAt),
      )
    );

  // Average Level from all wells
  const [avgLevelRes] = await db
    .select({ avg: avg(well.currentLevelPct) })
    .from(well);

  // Today's Consumption (sum of flow_rate readings since 00:00)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [consumptionRes] = await db
    .select({ total: sum(sensorData.value) })
    .from(sensorData)
    .innerJoin(sensors, eq(sensors.id, sensorData.sensorId))
    .where(
      and(
        eq(sensors.type, "flow_rate"),
        gte(sensorData.timestamp, today)
      )
    );

  const consumptionVal = Number(consumptionRes?.total ?? 0);
  // Format consumption: if > 1M show M, else just the number
  const formattedConsumption = consumptionVal > 1000000 
    ? (consumptionVal / 1000000).toFixed(1) + "M"
    : consumptionVal.toLocaleString("ar-EG");

  return {
    totalWells:     totalWells?.count  ?? 0,
    criticalAlerts: criticalAlerts?.count ?? 0,
    todayConsumption: formattedConsumption,
    avgLevel: Math.round(Number(avgLevelRes?.avg ?? 0)) + "%",
  };
}

const cards = (kpi: Awaited<ReturnType<typeof getKpiData>>) => [
  {
    label: "إجمالي الآبار النشطة",
    value: kpi.totalWells.toLocaleString("ar-EG"),
    icon: Droplets,
    border: "border-r-blue-500",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-500",
  },
  {
    label: "تنبيهات حرجة",
    value: String(kpi.criticalAlerts),
    icon: AlertTriangle,
    border: "border-r-red-500",
    iconBg: "bg-red-50",
    iconColor: "text-red-500",
  },
  {
    label: "استهلاك اليوم (م³)",
    value: kpi.todayConsumption,
    icon: Activity,
    border: "border-r-teal-500",
    iconBg: "bg-teal-50",
    iconColor: "text-teal-500",
  },
  {
    label: "متوسط منسوب المياه",
    value: kpi.avgLevel,
    icon: TrendingDown,
    border: "border-r-amber-500",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-500",
  },
] as const;

export async function KpiCards() {
  const kpi = await getKpiData();

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards(kpi).map((card) => (
        <div
          key={card.label}
          className={`bg-white rounded-xl border border-gray-200 border-r-4 ${card.border} p-5 shadow-sm`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500 font-medium">
              {card.label}
            </span>
            <div className={`p-2 rounded-lg ${card.iconBg}`}>
              <card.icon className={`h-4 w-4 ${card.iconColor}`} />
            </div>
          </div>
          <div className="text-3xl font-bold">{card.value}</div>
        </div>
      ))}
    </div>
  );
}