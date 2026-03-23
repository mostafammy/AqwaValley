/**
 * Irrigation Recommendation Orchestrator — Entry point for AI irrigation planning.
 *
 * Orchestration pipeline:
 * 1. Gather farm, zones, quota, soil readings, weather (in parallel)
 * 2. Build the desert-specific prompt
 * 3. Call AI with model cascade
 * 4. Parse + Zod-validate AI output (never trust raw AI)
 * 5. Hard quota enforcement (AI cannot override the database)
 * 6. Persist full traceability record
 *
 * Security rules:
 * - farmId comes from caller (validated by tRPC context) — never from user input
 * - Quota hard check is independent of AI output
 * - DB writes use parsed, validated plan — never raw AI output
 *
 * @module server/services/irrigation/recommend
 */

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "~/server/db";
import {
  cropProfile,
  district,
  farm,
  farmPeriodConsumptionSnapshot,
  irrigationRecommendation,
  latestSensorState,
  sensors,
  well,
  farmWell,
} from "~/server/db/schema";
import { callIrrigationAI } from "~/server/ai/openrouter-client";
import { irrigationPlanSchema, type IrrigationPlan } from "./schemas";
import {
  buildIrrigationPrompt,
  type PromptContext,
  type PromptZoneContext,
  type PromptSoilReading,
} from "./prompt-builder";
import { generateRuleBasedPlan, type FallbackResult } from "./fallback";
import { getWeatherForecast } from "./weather";
import { logger } from "~/lib/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecommendationResult {
  readonly success: true;
  readonly fallback: boolean;
  readonly recommendation: {
    readonly id: string;
    readonly plan: IrrigationPlan;
    readonly modelUsed: string | null;
    readonly fallback: boolean;
    readonly status: string;
    readonly createdAt: Date;
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build zone context for the prompt from crop profiles.
 * Maps crop profiles to the PromptZoneContext interface.
 */
function buildZoneContexts(
  cropProfiles: Array<{
    id: string;
    farmId: string;
    cropType: string;
    growthStage: string;
    targetSoilMoisturePct: string | null;
  }>,
  farmAreaAcres: string | null,
): PromptZoneContext[] {
  const totalAreaHa = farmAreaAcres
    ? parseFloat(farmAreaAcres) * 0.404686 // acres to hectares
    : 1;

  // Distribute area evenly across zones (simplification for now)
  const areaPerZone =
    cropProfiles.length > 0 ? totalAreaHa / cropProfiles.length : totalAreaHa;

  return cropProfiles.map((cp) => ({
    id: cp.id,
    name: `Zone-${cp.cropType}`,
    cropType: cp.cropType,
    growthStage: cp.growthStage,
    areaHectares: parseFloat(areaPerZone.toFixed(2)),
    irrigationSystem: "drip" as const, // default — most common in New Valley
  }));
}

/**
 * Fetch soil readings from the latestSensorState table for wells associated
 * with the farm. Returns humidity readings keyed by crop profile ID.
 */
async function fetchSoilReadings(
  farmId: string,
): Promise<Record<string, PromptSoilReading | null>> {
  const wellSensors = await db
    .select({
      sensorId: latestSensorState.sensorId,
      value: latestSensorState.value,
      type: latestSensorState.type,
    })
    .from(latestSensorState)
    .innerJoin(sensors, eq(latestSensorState.sensorId, sensors.id))
    .innerJoin(well, eq(sensors.wellId, well.id))
    .innerJoin(farmWell, eq(well.id, farmWell.wellId))
    .where(
      and(
        eq(farmWell.farmId, farmId),
        eq(latestSensorState.type, "humidity"),
      ),
    );

  // Build a simple reading map
  // For now, we aggregate humidity readings into a single value per farm
  const readings: Record<string, PromptSoilReading | null> = {};

  if (wellSensors.length > 0) {
    const avgHumidity =
      wellSensors.reduce((sum, s) => sum + s.value, 0) / wellSensors.length;

    // Temperature readings
    const tempSensors = await db
      .select({
        value: latestSensorState.value,
      })
      .from(latestSensorState)
      .innerJoin(sensors, eq(latestSensorState.sensorId, sensors.id))
      .innerJoin(well, eq(sensors.wellId, well.id))
      .innerJoin(farmWell, eq(well.id, farmWell.wellId))
      .where(
        and(
          eq(farmWell.farmId, farmId),
          eq(latestSensorState.type, "temperature"),
        ),
      );

    const avgTemp =
      tempSensors.length > 0
        ? tempSensors.reduce((sum, s) => sum + s.value, 0) /
          tempSensors.length
        : 30; // default desert temp

    // Apply same reading to all zones (one farm → shared sensors)
    return new Proxy(
      {},
      {
        get: () => ({
          humidityPct: avgHumidity,
          tempCelsius: avgTemp,
        }),
      },
    ) as Record<string, PromptSoilReading | null>;
  }

  return readings;
}

/**
 * Fetch the current month's quota from the consumption snapshot.
 */
async function fetchQuotaContext(
  farmId: string,
  monthlyQuotaM3: string | null,
): Promise<{
  monthlyLimit: number;
  usedLitres: number;
  remainingLitres: number;
}> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Try to get from consumption snapshot
  const [snapshot] = await db
    .select({
      quotaM3: farmPeriodConsumptionSnapshot.quotaM3,
      consumptionM3: farmPeriodConsumptionSnapshot.consumptionM3,
    })
    .from(farmPeriodConsumptionSnapshot)
    .where(
      and(
        eq(farmPeriodConsumptionSnapshot.farmId, farmId),
        eq(farmPeriodConsumptionSnapshot.periodType, "monthly"),
        gte(farmPeriodConsumptionSnapshot.periodStart, monthStart),
        lte(farmPeriodConsumptionSnapshot.periodEnd, monthEnd),
      ),
    )
    .orderBy(desc(farmPeriodConsumptionSnapshot.computedAt))
    .limit(1);

  if (snapshot) {
    const quotaLitres = parseFloat(snapshot.quotaM3) * 1000; // m³ → litres
    const usedLitres = parseFloat(snapshot.consumptionM3) * 1000;
    return {
      monthlyLimit: quotaLitres,
      usedLitres,
      remainingLitres: Math.max(0, quotaLitres - usedLitres),
    };
  }

  // Fallback: use farm's monthly quota
  const quotaM3 = monthlyQuotaM3 ? parseFloat(monthlyQuotaM3) : 10000;
  const quotaLitres = quotaM3 * 1000;
  return {
    monthlyLimit: quotaLitres,
    usedLitres: 0,
    remainingLitres: quotaLitres,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Request an AI-powered irrigation plan for a farm.
 *
 * @param farmId     - The farm UUID (validated by caller)
 * @param userId     - The requesting user's ID (from session)
 * @returns The recommendation result (AI or fallback)
 */
export async function requestIrrigationPlan(
  farmId: string,
  userId: string,
): Promise<RecommendationResult | FallbackResult> {
  // ── 1. Gather all context ──────────────────────────────────────────────

  const [farmRecord, cropProfiles] = await Promise.all([
    db
      .select({
        id: farm.id,
        name: farm.name,
        districtId: farm.districtId,
        totalAreaAcres: farm.totalAreaAcres,
        monthlyQuotaM3: farm.monthlyQuotaM3,
      })
      .from(farm)
      .where(eq(farm.id, farmId))
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select({
        id: cropProfile.id,
        farmId: cropProfile.farmId,
        cropType: cropProfile.cropType,
        growthStage: cropProfile.growthStage,
        targetSoilMoisturePct: cropProfile.targetSoilMoisturePct,
      })
      .from(cropProfile)
      .where(eq(cropProfile.farmId, farmId)),
  ]);

  if (!farmRecord) {
    throw new Error("Farm not found");
  }

  // Get district name for the prompt
  const [districtRecord] = await db
    .select({ name: district.name })
    .from(district)
    .where(eq(district.id, farmRecord.districtId))
    .limit(1);

  const districtName = districtRecord?.name ?? "Unknown District";

  // Gather remaining context in parallel
  const [soilReading, quota] = await Promise.all([
    fetchSoilReadings(farmId),
    fetchQuotaContext(farmId, farmRecord.monthlyQuotaM3),
  ]);

  const weather = getWeatherForecast(farmRecord.districtId);

  // Build zone context from crop profiles
  const zones = buildZoneContexts(cropProfiles, farmRecord.totalAreaAcres);

  if (zones.length === 0) {
    throw new Error("No crop zones configured for this farm");
  }

  const totalAreaHa = farmRecord.totalAreaAcres
    ? parseFloat(farmRecord.totalAreaAcres) * 0.404686
    : 1;

  const ctx: PromptContext = {
    farm: {
      name: farmRecord.name,
      districtName,
      areaHectares: parseFloat(totalAreaHa.toFixed(2)),
    },
    zones,
    quota,
    soilReading,
    weather,
  };

  // ── 2. Build the prompt ────────────────────────────────────────────────

  const { systemPrompt, userMessage } = buildIrrigationPrompt(ctx);

  // ── 3. Call AI with model cascade ──────────────────────────────────────

  let rawResponse: string;
  let modelUsed: string;

  try {
    const result = await callIrrigationAI(systemPrompt, userMessage);
    rawResponse = result.text;
    modelUsed = result.modelUsed;
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "ALL_MODELS_EXHAUSTED") {
      logger.warn("ai.irrigation.all_models_exhausted — using fallback");
      return generateRuleBasedPlan({
        farm: ctx.farm,
        zones: ctx.zones,
        quota: ctx.quota,
        soilReading: ctx.soilReading,
      });
    }
    throw err;
  }

  // ── 4. Parse + validate — never trust raw AI output ───────────────────

  let plan: IrrigationPlan;
  try {
    const cleaned = rawResponse.replace(/```json|```/g, "").trim();
    plan = irrigationPlanSchema.parse(JSON.parse(cleaned));
  } catch (parseErr) {
    logger.error(
      { error: parseErr },
      "ai.irrigation.parse_failed — using fallback",
    );
    return generateRuleBasedPlan({
      farm: ctx.farm,
      zones: ctx.zones,
      quota: ctx.quota,
      soilReading: ctx.soilReading,
    });
  }

  // ── 5. Hard quota enforcement — AI cannot override the database ───────

  const totalRequested = plan.zones.reduce(
    (sum, z) => sum + z.recommendedLitres,
    0,
  );

  if (totalRequested > quota.remainingLitres) {
    const scaleFactor = quota.remainingLitres / totalRequested;
    plan = {
      ...plan,
      quotaWarning: true,
      totalLitres: Math.round(quota.remainingLitres),
      zones: plan.zones.map((z) => ({
        ...z,
        recommendedLitres: Math.round(z.recommendedLitres * scaleFactor),
      })),
    };
  }

  // ── 6. Persist — store full traceability record ────────────────────────

  const [recommendation] = await db
    .insert(irrigationRecommendation)
    .values({
      farmId,
      requestedBy: userId,
      systemPrompt,
      userMessage,
      rawResponse,
      plan: plan as unknown as Record<string, unknown>,
      totalLitres: plan.totalLitres,
      modelUsed,
      fallback: false,
      status: "PENDING",
    })
    .returning();

  if (!recommendation) {
    throw new Error("Failed to persist irrigation recommendation");
  }

  logger.info(
    {
      recommendationId: recommendation.id,
      modelUsed,
      totalLitres: plan.totalLitres,
      quotaWarning: plan.quotaWarning,
    },
    "ai.irrigation.plan_generated",
  );

  return {
    success: true,
    fallback: false,
    recommendation: {
      id: recommendation.id,
      plan,
      modelUsed,
      fallback: false,
      status: recommendation.status,
      createdAt: recommendation.createdAt,
    },
  };
}
