import { db } from "~/server/db";
import { well, alerts, sensorData, sensors } from "~/server/db/schema";
import { eq, count, and, isNull, avg, sum, sql, gte } from "drizzle-orm";
import { Droplets, AlertTriangle, Activity, TrendingDown } from "lucide-react";
import { KpiCardGrid, type KpiCardProps } from "~/app/_components/UI/KpiCardGrid";

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

  // Today's Consumption (sum of flow_rate readings since 00:00 Cairo time)
  // Derive midnight in Africa/Cairo timezone robustly
  const now = new Date();
  const cairoTimeParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const getPart = (type: string) => cairoTimeParts.find(p => p.type === type)?.value;
  const todayStr = `${getPart("year")}-${getPart("month")}-${getPart("day")}T00:00:00+02:00`;
  const today = new Date(todayStr);

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
  
  // Format consumption: Standardized Arabic formatting with compact notation for >= 1M
  const formatter = new Intl.NumberFormat("ar-EG", {
    notation: consumptionVal >= 1000000 ? "compact" : "standard",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  });
  const formattedConsumption = formatter.format(consumptionVal);

  return {
    totalWells:     totalWells?.count  ?? 0,
    criticalAlerts: criticalAlerts?.count ?? 0,
    todayConsumption: formattedConsumption,
    avgLevel: Math.round(Number(avgLevelRes?.avg ?? 0)) + "%",
  };
}

const cards = (kpi: Awaited<ReturnType<typeof getKpiData>>): KpiCardProps[] => [
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
];

export async function KpiCards() {
  const kpi = await getKpiData();

  return <KpiCardGrid cards={cards(kpi)} />;
}
