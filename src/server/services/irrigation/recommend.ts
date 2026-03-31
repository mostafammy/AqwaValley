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

import { and, desc, eq, gte, lte } from "drizzle-orm";

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

import {
  fetchSoilReadings,
  fetchQuotaContext,
} from "./recommend_helpers";

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
    .select({ 
      name: district.name,
    })
    .from(district)
    .where(eq(district.id, farmRecord.districtId))
    .limit(1);

  const districtName = districtRecord?.name ?? "Unknown District";

  // Gather remaining context in parallel
  const [soilReading, quota, assignedWells] = await Promise.all([
    fetchSoilReadings(farmId),
    fetchQuotaContext(farmId, farmRecord.monthlyQuotaM3),
    db
      .select({
        lat: well.latitude,
        lon: well.longitude,
      })
      .from(farmWell)
      .innerJoin(well, eq(farmWell.wellId, well.id))
      .where(eq(farmWell.farmId, farmId))
      .limit(1),
  ]);

  // Resolve coordinates: Primary Well -> District Center -> Default Kharga (25.44, 30.54)
  // Resolve coordinates: Primary Well -> Default Kharga (25.44, 30.54)
  const wellLat = Number(assignedWells[0]?.lat);
  const wellLon = Number(assignedWells[0]?.lon);

  const lat = Number.isFinite(wellLat) ? wellLat : 25.4474;
  const lon = Number.isFinite(wellLon) ? wellLon : 30.546;

  const weather = await getWeatherForecast(lat, lon);

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

  let isFallback = false;
  let rawResponse = "";
  let modelUsed = "";
  let plan: IrrigationPlan;

  try {
    const result = await callIrrigationAI(systemPrompt, userMessage);
    rawResponse = result.text;
    modelUsed = result.modelUsed;
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "ALL_MODELS_EXHAUSTED") {
      logger.warn("ai.irrigation.all_models_exhausted — using fallback");
      const fallbackResult = generateRuleBasedPlan({
        farm: ctx.farm,
        zones: ctx.zones,
        quota: ctx.quota,
        soilReading: ctx.soilReading,
        weather: ctx.weather,
      });
      plan = fallbackResult.recommendation.plan;
      isFallback = true;
      rawResponse = "FALLBACK_GENERATED";
      modelUsed = "rule-based-engine";
    } else {
      throw err;
    }
  }

  // ── 4. Parse + validate — never trust raw AI output ───────────────────
  if (!isFallback) {
    try {
      const cleaned = rawResponse.replace(/```json|```/g, "").trim();
      plan = irrigationPlanSchema.parse(JSON.parse(cleaned));
    } catch (parseErr) {
      logger.error(
        { error: parseErr },
        "ai.irrigation.parse_failed — using fallback",
      );
      const fallbackResult = generateRuleBasedPlan({
        farm: ctx.farm,
        zones: ctx.zones,
        quota: ctx.quota,
        soilReading: ctx.soilReading,
        weather: ctx.weather,
      });
      plan = fallbackResult.recommendation.plan;
      isFallback = true;
      rawResponse = "FALLBACK_PARSING_ERROR";
      modelUsed = "rule-based-engine";
    }
  }

  // ── 5. Hard quota enforcement — AI cannot override the database ───────
  // only if not already scaled by fallback (fallback does its own scaling)
  if (!isFallback) {
    const totalRequested = plan.zones.reduce(
    (sum, z) => sum + z.recommendedLitres,
    0,
  );

  if (totalRequested > quota.remainingLitres) {
    const remainingQuota = Math.max(0, Math.floor(quota.remainingLitres));
    const scaleFactor =
      totalRequested > 0 ? remainingQuota / totalRequested : 0;

    const scaledZones = plan.zones.map((z) => ({
      ...z,
      recommendedLitres:
        z.recommendedLitres > 0
          ? Math.max(1, Math.round(z.recommendedLitres * scaleFactor))
          : 0,
    }));

    let scaledTotal = scaledZones.reduce(
      (sum, z) => sum + z.recommendedLitres,
      0,
    );

    // Reduce from largest zones first so final sum never exceeds quota.
    if (scaledTotal > remainingQuota) {
      let overflow = scaledTotal - remainingQuota;
      const sortedIndexes = scaledZones
        .map((zone, index) => ({
          index,
          original: plan.zones[index]?.recommendedLitres ?? 0,
          scaled: zone.recommendedLitres,
        }))
        .sort((a, b) => b.scaled - a.scaled);

      // First pass: keep zones that originally needed water at a minimum of 1.
      for (const item of sortedIndexes) {
        if (overflow <= 0) break;

        const current = scaledZones[item.index]?.recommendedLitres ?? 0;
        const minAllowed = item.original > 0 ? 1 : 0;
        const reducible = Math.max(0, current - minAllowed);
        if (reducible === 0) continue;

        const reduceBy = Math.min(reducible, overflow);
        const zone = scaledZones[item.index];
        if (zone) {
          zone.recommendedLitres = current - reduceBy;
        }
        overflow -= reduceBy;
      }

      // Second pass: rare edge case where quota is too small to keep all positive zones at 1.
      if (overflow > 0) {
        for (const item of sortedIndexes) {
          if (overflow <= 0) break;

          const current = scaledZones[item.index]?.recommendedLitres ?? 0;
          if (current <= 0) continue;

          const reduceBy = Math.min(current, overflow);
          const zone = scaledZones[item.index];
          if (zone) {
            zone.recommendedLitres = current - reduceBy;
          }
          overflow -= reduceBy;
        }
      }

      scaledTotal = scaledZones.reduce(
        (sum, z) => sum + z.recommendedLitres,
        0,
      );
    }

      plan = {
        ...plan,
        quotaWarning: true,
        totalLitres: scaledTotal,
        zones: scaledZones,
      };
    }
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
      fallback: isFallback,
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
    fallback: isFallback,
    recommendation: {
      id: recommendation.id,
      plan,
      modelUsed,
      fallback: isFallback,
      status: recommendation.status,
      createdAt: recommendation.createdAt,
    },
  };
}
