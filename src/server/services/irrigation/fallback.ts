/**
 * FAO-56 Rule-Based Fallback Engine — Deterministic irrigation planning.
 *
 * This runs when:
 * - All 3 AI models return 429/503 (ALL_MODELS_EXHAUSTED)
 * - AI response fails Zod validation
 *
 * No external dependencies. No API calls. Always returns a valid plan.
 * Returns `fallback: true` so the UI displays "AI unavailable — rule-based plan".
 *
 * Calculation:
 *   ETc = ET₀ × Kc (crop coefficient for growth stage)
 *   Gross = ETc ÷ irrigation efficiency
 *   Litres = Gross × deficit_fraction × area × 10,000
 *
 * @module server/services/irrigation/fallback
 */

import type { IrrigationPlan } from "./schemas";

// ---------------------------------------------------------------------------
// Domain Constants
// ---------------------------------------------------------------------------

/** Crop coefficients (Kc) by crop type and growth stage. */
const KC_VALUES: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  wheat: {
    germination: 0.3,
    vegetative: 0.7,
    flowering: 1.15,
    grain_fill: 1.1,
    maturity: 0.4,
  },
  date_palm: {
    vegetative: 0.9,
    flowering: 0.95,
    fruiting: 1.05,
    maturity: 0.95,
  },
  corn: {
    germination: 0.3,
    vegetative: 0.75,
    flowering: 1.2,
    grain_fill: 1.15,
    maturity: 0.6,
  },
  sugar_beet: {
    germination: 0.35,
    vegetative: 0.75,
    flowering: 1.2,
    maturity: 0.7,
  },
  alfalfa: {
    vegetative: 0.8,
    peak: 1.15,
    dormant: 0.5,
  },
} as const;

/** Irrigation system efficiency factors. */
const EFFICIENCY: Readonly<Record<string, number>> = {
  drip: 0.9,
  sprinkler: 0.75,
  flood: 0.6,
} as const;

/** Field capacity targets (% soil moisture) by crop. */
const FIELD_CAPACITY: Readonly<Record<string, number>> = {
  wheat: 70,
  date_palm: 50,
  corn: 72,
  sugar_beet: 65,
  alfalfa: 75,
} as const;

/** Conservative New Valley annual average ET₀ (mm/day). */
const ET0_DEFAULT = 7.5;

const DEFAULT_KC = 0.8;
const DEFAULT_EFFICIENCY = 0.75;
const DEFAULT_FIELD_CAPACITY = 65;
const DEFAULT_HUMIDITY = 50;
const DEFAULT_SCHEDULE_TIME = "05:30";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FallbackZone {
  readonly id: string;
  readonly name: string;
  readonly cropType: string;
  readonly growthStage: string;
  readonly areaHectares: number;
  readonly irrigationSystem: "drip" | "sprinkler" | "flood";
}

export interface FallbackInput {
  readonly farm: {
    readonly name: string;
    readonly districtName: string;
    readonly areaHectares: number;
  };
  readonly zones: readonly FallbackZone[];
  readonly quota: {
    readonly monthlyLimit: number;
    readonly usedLitres: number;
    readonly remainingLitres: number;
  };
  readonly soilReading: Readonly<
    Record<string, { readonly humidityPct: number } | null>
  >;
  readonly weather?: {
    readonly daily: readonly {
      readonly maxTemp: number;
      readonly et0: number;
      readonly rain: number;
    }[];
  };
}

export interface FallbackResult {
  readonly success: true;
  readonly fallback: true;
  readonly recommendation: IrrigationPlan;
}

// ---------------------------------------------------------------------------
// Core Calculation
// ---------------------------------------------------------------------------

function calculateZoneLitres(
  zone: FallbackZone,
  humidityPct: number,
  et0: number,
  rainForecastMm = 0,
): number {
  const cropKey = zone.cropType.toLowerCase();
  const stageKey = zone.growthStage.toLowerCase();

  const Kc = KC_VALUES[cropKey]?.[stageKey] ?? DEFAULT_KC;
  // Subtract rainfall from ETc as it's free water
  const ETc = Math.max(0, et0 * Kc - rainForecastMm);
  const efficiency = EFFICIENCY[zone.irrigationSystem] ?? DEFAULT_EFFICIENCY;
  const grossETc = ETc / efficiency;

  const target = FIELD_CAPACITY[cropKey] ?? DEFAULT_FIELD_CAPACITY;
  const deficitPct = Math.max(0, target - humidityPct) / 100;

  // litres = gross ETc (mm) × deficit fraction × area (ha) × 10,000 m²/ha × 0.001 m³/L × 1000 L/m³
  const litresPerHa = grossETc * deficitPct * 10 * 1000;
  return Math.round(litresPerHa * zone.areaHectares);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic, rule-based irrigation plan using FAO-56 ETc.
 *
 * @param ctx - Farm, zones, quota, and soil reading context
 * @returns A valid irrigation plan with `fallback: true`
 */
export function generateRuleBasedPlan(ctx: FallbackInput): FallbackResult {
  const currentEt0 = ctx.weather?.daily[0]?.et0 ?? ET0_DEFAULT;
  const rainNext24h = ctx.weather?.daily[0]?.rain ?? 0;

  const zonePlans = ctx.zones.map((zone) => {
    const currentHumidity =
      ctx.soilReading[zone.id]?.humidityPct ?? DEFAULT_HUMIDITY;
    const totalLitres = calculateZoneLitres(
      zone,
      currentHumidity,
      currentEt0,
      rainNext24h,
    );

    return {
      zoneId: zone.id,
      cropType: zone.cropType,
      growthStage: zone.growthStage,
      recommendedLitres: totalLitres,
      scheduledAt: DEFAULT_SCHEDULE_TIME,
      confidence: "MEDIUM" as const,
      notes: `Rule-based ETc calculation — ${ctx.weather ? "Live" : "Static"} Weather Used`,
    };
  });

  const total = zonePlans.reduce((sum, z) => sum + z.recommendedLitres, 0);
  const quotaWarning = total > ctx.quota.remainingLitres;

  // Scale down proportionally if over quota
  let scaledZones = zonePlans;
  if (quotaWarning) {
    if (total > 0 && ctx.quota.remainingLitres > 0) {
      const factor = ctx.quota.remainingLitres / total;
      scaledZones = zonePlans.map((z) => ({
        ...z,
        recommendedLitres:
          z.recommendedLitres === 0
            ? 0
            : Math.max(1, Math.round(z.recommendedLitres * factor)),
        notes: "Scaled down to fit remaining quota — rule-based ETc",
      }));
    } else {
      scaledZones = zonePlans.map((z) => ({
        ...z,
        recommendedLitres: 0,
        notes: "Quota exhausted — rule-based ETc",
      }));
    }
  }

  const scaledTotal = scaledZones.reduce(
    (sum, z) => sum + z.recommendedLitres,
    0,
  );

  return {
    success: true,
    fallback: true,
    recommendation: {
      reasoning: `Rule-based FAO-56 ETc plan generated (AI unavailable). ETc = ET₀(${currentEt0}mm/day) × Kc per crop stage.${rainNext24h > 0 ? ` Adjusted for ${rainNext24h}mm rain.` : ""}${quotaWarning ? " Plan scaled to fit remaining quota." : ""}`,
      totalLitres: scaledTotal,
      quotaWarning,
      zones: scaledZones,
    },
  };
}
