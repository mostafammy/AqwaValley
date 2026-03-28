import { eq } from "drizzle-orm";
import { type db as DbInstance } from "~/server/db";
import { district } from "~/server/db/schema";

export type ForecastPoint = {
  date: string;
  predictedLevel: number;
  historicalLevel?: number;
  lowerBound: number;
  upperBound: number;
};

export type ConsumptionScenario = {
  id: string;
  name: string;
  description: string;
  impactOnDepletionPct: number;
  predictedLevelAfter12m: number;
};

export type ForecastSummary = {
  districtId: string;
  districtName: string;
  currentLevelM: number;
  annualDepletionRateM: number;
  yearsUntilCritical: number;
  sustainabilityScore: number; // 0-100
  lastUpdated: string;
  trend: "stable" | "declining" | "critical";
};

export type DistrictForecast = {
  summary: ForecastSummary;
  monthlyPredictions: ForecastPoint[];
  scenarios: ConsumptionScenario[];
};

type Db = typeof DbInstance;

export async function getDistrictForecast(
  db: Db,
  districtId: string,
): Promise<DistrictForecast> {
  const districtData = await db
    .select()
    .from(district)
    .where(eq(district.id, districtId))
    .limit(1);

  const d = districtData[0];
  if (!d) {
    throw new Error("District not found");
  }

  const baselineDepth = Number(d.baselineDepthM ?? 120);
  const depletionRate = Number(d.annualDepletionRateM ?? 0.85);

  // Mock current level — slightly deeper than baseline due to historical depletion
  // deterministic base (Math.random replaced by floor check for demo)
  const currentLevel = baselineDepth + depletionRate * 5 + (districtId.length % 5);
  
  // Predict 24 months (starting from current month)
  const now = new Date();
  const monthlyPredictions: ForecastPoint[] = [];

  for (let i = 0; i <= 24; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthOffset = i / 12;
    
    // Base prediction is current level + annual rate * years
    // Add seasonal variation (sinusoidal)
    const seasonalImpact = 2 * Math.sin((2 * Math.PI * (date.getMonth() + 1)) / 12);
    const predicted = currentLevel + depletionRate * monthOffset + seasonalImpact;

    monthlyPredictions.push({
      date: date.toISOString(),
      predictedLevel: Number(predicted.toFixed(2)),
      historicalLevel: i === 0 ? Number(currentLevel.toFixed(2)) : undefined,
      lowerBound: Number((predicted - 1.5 - monthOffset * 2).toFixed(2)),
      upperBound: Number((predicted + 1.5 + monthOffset * 2).toFixed(2)),
    });
  }

  // Calculate years until critical level
  const criticalThresholdPct = Number(d.criticalThresholdPct ?? 85); 
  // Compute critical depth based on baseline and threshold (demo logic)
  const criticalDepth = baselineDepth + (criticalThresholdPct / 100) * 100; 

  const remainingDepth = Math.max(0, criticalDepth - currentLevel);
  const yearsUntilCritical = depletionRate > 0 ? remainingDepth / depletionRate : Number.POSITIVE_INFINITY;

  const sustainabilityScore = Math.max(0, Math.min(100, 100 - (depletionRate / 2) * 100));

  const scenarios: ConsumptionScenario[] = [
    {
      id: "business_as_usual",
      name: "الاستهلاك الحالي",
      description: "استمرار أنماط الاستهلاك الحالية دون تغيير.",
      impactOnDepletionPct: 0,
      predictedLevelAfter12m: Number((currentLevel + depletionRate).toFixed(2)),
    },
    {
      id: "moderate_conservation",
      name: "ترشيد متوسط",
      description: "تقليل استخدام المياه في الزراعة بنسبة ١٥٪.",
      impactOnDepletionPct: -15,
      predictedLevelAfter12m: Number((currentLevel + depletionRate * 0.85).toFixed(2)),
    },
    {
      id: "aggressive_conservation",
      name: "ترشيد مكثف",
      description: "تقليل الاستهلاك بنسبة ٣٠٪ عبر تقنيات الري الذكي.",
      impactOnDepletionPct: -30,
      predictedLevelAfter12m: Number((currentLevel + depletionRate * 0.70).toFixed(2)),
    },
  ];

  return {
    summary: {
      districtId: d.id,
      districtName: d.name,
      currentLevelM: Number(currentLevel.toFixed(2)),
      annualDepletionRateM: depletionRate,
      yearsUntilCritical: Number(yearsUntilCritical.toFixed(1)),
      sustainabilityScore: Math.round(sustainabilityScore),
      lastUpdated: now.toISOString(),
      trend: depletionRate > 1.5 ? "critical" : depletionRate > 0.5 ? "declining" : "stable",
    },
    monthlyPredictions,
    scenarios,
  };
}
