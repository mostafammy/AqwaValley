import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "~/server/db";
import {
  farmWell,
  well,
  sensors,
  latestSensorState,
  farmPeriodConsumptionSnapshot,
} from "~/server/db/schema";

export const DEFAULT_MONTHLY_QUOTA_M3 = 10000;

/**
 * Fetch soil sensory data (humidity, temperature) from all active sensors on the farm.
 * Returns a map of wellId -> { humidityPct, tempCelsius }.
 */
export async function fetchSoilReadings(
  farmId: string,
): Promise<Record<string, { humidityPct: number | null; tempCelsius: number | null }>> {
  const farmWells = await db
    .select({ wellId: farmWell.wellId })
    .from(farmWell)
    .where(eq(farmWell.farmId, farmId));

  const wellIds = farmWells.map((f) => f.wellId);
  if (wellIds.length === 0) return {};

  const allLatestStates = await db
    .select({
      wellId: latestSensorState.wellId,
      type: latestSensorState.type,
      value: latestSensorState.value,
    })
    .from(latestSensorState)
    .innerJoin(sensors, eq(latestSensorState.sensorId, sensors.id))
    .where(
      and(
        eq(sensors.isActive, true),
        inArray(latestSensorState.wellId, wellIds),
      ),
    );

  const filtered = allLatestStates;

  const resultMap: Record<string, { humidityPct: number | null; tempCelsius: number | null }> = {};
  
  filtered.forEach((s) => {
    if (!s.wellId) return;
    const val = Number(s.value);
    if (!Number.isFinite(val)) return;

    if (!resultMap[s.wellId]) {
      resultMap[s.wellId] = { humidityPct: null, tempCelsius: null };
    }
    if (s.type === "humidity") resultMap[s.wellId]!.humidityPct = val;
    if (s.type === "temperature") resultMap[s.wellId]!.tempCelsius = val;
  });

  return resultMap;
}

/**
 * Fetch the current quota context (monthly/annual) for the farm.
 */
export async function fetchQuotaContext(
  farmId: string,
  monthlyQuotaM3: string | null,
) {
  // Try to get the latest pre-computed snapshot for the current month
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const snapshot = await db
    .select({
      quotaLitres: farmPeriodConsumptionSnapshot.quotaM3,
      consumptionLitres: farmPeriodConsumptionSnapshot.consumptionM3,
    })
    .from(farmPeriodConsumptionSnapshot)
    .where(
      and(
        eq(farmPeriodConsumptionSnapshot.farmId, farmId),
        eq(farmPeriodConsumptionSnapshot.periodType, "monthly"),
        gte(farmPeriodConsumptionSnapshot.periodStart, firstOfMonth),
      ),
    )
    .orderBy(desc(farmPeriodConsumptionSnapshot.computedAt))
    .limit(1);

  if (snapshot[0]) {
    const quotaLitres = Number(snapshot[0].quotaLitres) * 1000;
    const usedLitres = Number(snapshot[0].consumptionLitres) * 1000;
    return {
      monthlyLimit: quotaLitres,
      usedLitres,
      remainingLitres: Math.max(0, quotaLitres - usedLitres),
    };
  }

  // Fallback: use farm's monthly quota. Parse defensively to avoid NaN.
  const parsedM3 = monthlyQuotaM3 ? parseFloat(monthlyQuotaM3) : NaN;
  const quotaM3 = Number.isFinite(parsedM3) ? parsedM3 : DEFAULT_MONTHLY_QUOTA_M3;
  
  const quotaLitres = quotaM3 * 1000;
  return {
    monthlyLimit: quotaLitres,
    usedLitres: 0,
    remainingLitres: quotaLitres,
  };
}
