/**
 * Irrigation tRPC Router — API endpoints for AI irrigation planning.
 *
 * Endpoints:
 * - requestPlan: Generate a new AI-powered (or fallback) irrigation plan
 * - getLatestPlan: Retrieve the most recent plan for a farm
 * - listPlans: Paginated history of plans for a farm
 *
 * All endpoints require authentication (protectedProcedure).
 * Farm ownership is verified via the user's session.
 *
 * @module server/api/routers/irrigation
 */

import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  farm,
  irrigationEvent,
  irrigationRecommendation,
  irrigationSession,
  irrigationSimulationRun,
} from "~/server/db/schema";
import { evaluateAndPersistRunDiff } from "~/server/services/irrigation/runDiffService";
import { replaySimulationRun } from "~/server/services/irrigation/runReplayService";
import { requestIrrigationPlan } from "~/server/services/irrigation/recommend";
import {
  cancelIrrigationActivation,
  getIrrigationEventStatus,
  listRecentIrrigationEvents,
  startIrrigationActivation,
} from "~/server/services/irrigation/triggerService";
import { TRPCError } from "@trpc/server";

// ---------------------------------------------------------------------------
// Input Schemas
// ---------------------------------------------------------------------------

const requestPlanInput = z.object({
  farmId: z.string().uuid(),
});

const activatePlanInput = z.object({
  planId: z.string().uuid(),
});

const getLatestPlanInput = z.object({
  farmId: z.string().uuid(),
});

const listPlansInput = z.object({
  farmId: z.string().uuid(),
  limit: z.number().int().min(1).max(50).default(10),
  offset: z.number().int().min(0).default(0),
});

const activateRecommendationInput = z.object({
  farmId: z.string().uuid(),
  recommendationId: z.string().uuid(),
  wellIds: z.array(z.string().uuid()).min(1),
  durationMinutes: z
    .number()
    .int()
    .min(1)
    .max(24 * 60),
  planSource: z.string().min(1).max(64).optional(),
  modelMode: z.enum(["production", "demo"]).optional(),
});

const getIrrigationStatusInput = z.object({
  farmId: z.string().uuid(),
  irrigationEventId: z.string().uuid(),
});

const cancelIrrigationInput = z.object({
  farmId: z.string().uuid(),
  irrigationEventId: z.string().uuid(),
});

const listRecentIrrigationsInput = z.object({
  farmId: z.string().uuid(),
  limit: z.number().int().min(1).max(50).default(10),
  offset: z.number().int().min(0).default(0),
});

const replaySimulationRunInput = z.object({
  runId: z.string().uuid(),
});

const diffSimulationRunsInput = z.object({
  baseRunId: z.string().uuid(),
  candidateRunId: z.string().uuid(),
});

const saveSessionInput = z.object({
  farmId: z.string().uuid(),
  planId: z.string().uuid().nullable(),
  frameCount: z.number().int().min(0),
  litersPumped: z.number().nonnegative(),
  done: z.boolean(),
  running: z.boolean(),
});

const getSessionInput = z.object({
  farmId: z.string().uuid(),
  planId: z.string().uuid().nullable(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureUserCanAccessFarm(
  ctx: { session: { user: { id: string } }; userRoles: string[] },
  farmId: string,
) {
  const [farmRecord] = await db
    .select({
      id: farm.id,
      ownerId: farm.ownerId,
      farmerUserId: farm.farmerUserId,
    })
    .from(farm)
    .where(eq(farm.id, farmId))
    .limit(1);

  if (!farmRecord) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Farm not found",
    });
  }

  const userId = ctx.session.user.id;
  const isAdmin = ctx.userRoles.includes("admin");
  const isOwner = farmRecord.ownerId === userId;
  const isFarmer = farmRecord.farmerUserId === userId;

  if (!isOwner && !isFarmer && !isAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this farm",
    });
  }
}

async function ensureUserCanAccessSimulationRun(
  ctx: { session: { user: { id: string } }; userRoles: string[] },
  runId: string,
): Promise<string> {
  const [runRecord] = await db
    .select({ farmId: irrigationEvent.farmId })
    .from(irrigationSimulationRun)
    .innerJoin(
      irrigationEvent,
      eq(irrigationSimulationRun.irrigationEventId, irrigationEvent.id),
    )
    .where(eq(irrigationSimulationRun.id, runId))
    .limit(1);

  if (!runRecord) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Simulation run not found",
    });
  }

  await ensureUserCanAccessFarm(ctx, runRecord.farmId);
  return runRecord.farmId;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const irrigationRouter = createTRPCRouter({
  /**
   * Generate a new irrigation plan for a farm.
   *
   * Calls the AI orchestrator which:
   * 1. Gathers farm/zone/quota/soil/weather data
   * 2. Calls AI with model cascade
   * 3. Validates + enforces quota
   * 4. Persists traceability record
   * 5. Falls back to rule-based engine on any failure
   */
  requestPlan: protectedProcedure
    .input(requestPlanInput)
    .mutation(async ({ ctx, input }) => {
      await ensureUserCanAccessFarm(ctx, input.farmId);
      return requestIrrigationPlan(input.farmId, ctx.session.user.id);
    }),

  /**
   * Get the most recent irrigation plan for a farm.
   */
  getLatestPlan: protectedProcedure
    .input(getLatestPlanInput)
    .query(async ({ ctx, input }) => {
      await ensureUserCanAccessFarm(ctx, input.farmId);

      const [latest] = await ctx.db
        .select()
        .from(irrigationRecommendation)
        .where(eq(irrigationRecommendation.farmId, input.farmId))
        .orderBy(desc(irrigationRecommendation.createdAt))
        .limit(1);

      return latest ?? null;
    }),

  /**
   * Activate an irrigation plan (mark it as the one being followed).
   */
  activatePlan: protectedProcedure
    .input(activatePlanInput)
    .mutation(async ({ ctx, input }) => {
      // 1. Get the plan to find its farmId
      const [planRecord] = await ctx.db
        .select({ farmId: irrigationRecommendation.farmId })
        .from(irrigationRecommendation)
        .where(eq(irrigationRecommendation.id, input.planId))
        .limit(1);

      if (!planRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Irrigation plan not found",
        });
      }

      // 2. Verify access
      await ensureUserCanAccessFarm(ctx, planRecord.farmId);

      // 3. Update status
      const [updated] = await ctx.db
        .update(irrigationRecommendation)
        .set({
          status: "ACTIVATED",
          activatedAt: new Date(),
        })
        .where(eq(irrigationRecommendation.id, input.planId))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Could not activate plan: recommendation not found or deleted.",
        });
      }

      return updated;
    }),

  /**
   * List irrigation plan history for a farm (paginated).
   */
  listPlans: protectedProcedure
    .input(listPlansInput)
    .query(async ({ ctx, input }) => {
      await ensureUserCanAccessFarm(ctx, input.farmId);

      const plans = await ctx.db
        .select({
          id: irrigationRecommendation.id,
          farmId: irrigationRecommendation.farmId,
          totalLitres: irrigationRecommendation.totalLitres,
          modelUsed: irrigationRecommendation.modelUsed,
          fallback: irrigationRecommendation.fallback,
          status: irrigationRecommendation.status,
          createdAt: irrigationRecommendation.createdAt,
          activatedAt: irrigationRecommendation.activatedAt,
          plan: irrigationRecommendation.plan,
        })
        .from(irrigationRecommendation)
        .where(eq(irrigationRecommendation.farmId, input.farmId))
        .orderBy(desc(irrigationRecommendation.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return plans;
    }),

  /**
   * Get live inputs for a farm (soil, quota, etc.)
   */
  getLiveInputs: protectedProcedure
    .input(z.object({ farmId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await ensureUserCanAccessFarm(ctx, input.farmId);

      const [farmRecord] = await ctx.db
        .select({
          id: farm.id,
          monthlyQuotaM3: farm.monthlyQuotaM3,
        })
        .from(farm)
        .where(eq(farm.id, input.farmId))
        .limit(1);

      if (!farmRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Farm not found",
        });
      }

      const { fetchSoilReadings, fetchQuotaContext } = await import(
        "~/server/services/irrigation/recommend_helpers"
      );

      const [soilReadingMap, quota] = await Promise.all([
        fetchSoilReadings(input.farmId),
        fetchQuotaContext(input.farmId, farmRecord.monthlyQuotaM3),
      ]);

      const readings = Object.values(soilReadingMap).filter((r): r is { humidityPct: number; tempCelsius: number | null } => 
        r !== null && r.humidityPct !== null
      );
      const avgSoilMoisture =
        readings.length > 0
          ? readings.reduce((sum, r) => sum + r.humidityPct, 0) /
            readings.length
          : null;

      return {
        avgSoilMoisture,
        remainingQuotaLitres: quota.remainingLitres,
      };
    }),

  activateRecommendation: protectedProcedure
    .input(activateRecommendationInput)
    .mutation(async ({ ctx, input }) => {
      await ensureUserCanAccessFarm(ctx, input.farmId);

      return startIrrigationActivation({
        farmId: input.farmId,
        recommendationId: input.recommendationId,
        requestedByUserId: ctx.session.user.id,
        wellIds: input.wellIds,
        durationMinutes: input.durationMinutes,
        planSource: input.planSource,
        modelMode: input.modelMode,
      });
    }),

  getIrrigationStatus: protectedProcedure
    .input(getIrrigationStatusInput)
    .query(async ({ ctx, input }) => {
      await ensureUserCanAccessFarm(ctx, input.farmId);

      const status = await getIrrigationEventStatus(
        input.farmId,
        input.irrigationEventId,
      );

      if (!status) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Irrigation event not found.",
        });
      }

      return status;
    }),

  cancelIrrigation: protectedProcedure
    .input(cancelIrrigationInput)
    .mutation(async ({ ctx, input }) => {
      await ensureUserCanAccessFarm(ctx, input.farmId);

      return cancelIrrigationActivation({
        farmId: input.farmId,
        irrigationEventId: input.irrigationEventId,
        cancelledByUserId: ctx.session.user.id,
      });
    }),

  listRecentIrrigations: protectedProcedure
    .input(listRecentIrrigationsInput)
    .query(async ({ ctx, input }) => {
      await ensureUserCanAccessFarm(ctx, input.farmId);

      return listRecentIrrigationEvents({
        farmId: input.farmId,
        limit: input.limit,
        offset: input.offset,
      });
    }),

  replaySimulationRun: protectedProcedure
    .input(replaySimulationRunInput)
    .mutation(async ({ ctx, input }) => {
      await ensureUserCanAccessSimulationRun(ctx, input.runId);

      const replayResult = await replaySimulationRun(input.runId);
      if (!replayResult.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: replayResult.error.message,
        });
      }

      return replayResult.value;
    }),

  diffSimulationRuns: protectedProcedure
    .input(diffSimulationRunsInput)
    .mutation(async ({ ctx, input }) => {
      const baseFarmId = await ensureUserCanAccessSimulationRun(
        ctx,
        input.baseRunId,
      );
      const candidateFarmId = await ensureUserCanAccessSimulationRun(
        ctx,
        input.candidateRunId,
      );

      if (baseFarmId !== candidateFarmId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Simulation runs must belong to the same farm.",
        });
      }

      const diffResult = await evaluateAndPersistRunDiff({
        baseRunId: input.baseRunId,
        candidateRunId: input.candidateRunId,
      });

      if (!diffResult.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: diffResult.error.message,
        });
      }

      return diffResult.value;
    }),

  saveSession: protectedProcedure
    .input(saveSessionInput)
    .mutation(async ({ ctx, input }) => {
      // Verify access to the farm
      await ensureUserCanAccessFarm(ctx, input.farmId);

      // Check if session already exists
      const [existing] = await ctx.db
        .select()
        .from(irrigationSession)
        .where(
          input.planId
            ? and(
                eq(irrigationSession.farmId, input.farmId),
                eq(irrigationSession.planId, input.planId),
              )
            : eq(irrigationSession.farmId, input.farmId),
        )
        .limit(1);

      if (existing) {
        // Update existing session
        const [updated] = await ctx.db
          .update(irrigationSession)
          .set({
            planId: input.planId,
            frameCount: input.frameCount,
            litersPumped: input.litersPumped.toString(),
            done: input.done,
            running: input.running,
            updatedAt: new Date(),
          })
          .where(eq(irrigationSession.id, existing.id))
          .returning();

        return updated;
      }

      // Create new session
      const [newSession] = await ctx.db
        .insert(irrigationSession)
        .values({
          farmId: input.farmId,
          planId: input.planId,
          frameCount: input.frameCount,
          litersPumped: input.litersPumped.toString(),
          done: input.done,
          running: input.running,
        })
        .returning();

      return newSession;
    }),

  getSession: protectedProcedure
    .input(getSessionInput)
    .query(async ({ ctx, input }) => {
      // Verify access to the farm
      await ensureUserCanAccessFarm(ctx, input.farmId);

      // Get the most recent session for this farm (filtered by planId if provided)
      const [session] = await ctx.db
        .select()
        .from(irrigationSession)
        .where(
          input.planId
            ? and(
                eq(irrigationSession.farmId, input.farmId),
                eq(irrigationSession.planId, input.planId),
              )
            : eq(irrigationSession.farmId, input.farmId),
        )
        .orderBy(desc(irrigationSession.updatedAt))
        .limit(1);

      if (!session) {
        return null;
      }

      return {
        id: session.id,
        farmId: session.farmId,
        planId: session.planId,
        frameCount: session.frameCount,
        litersPumped: parseFloat(session.litersPumped),
        done: session.done,
        running: session.running,
        updatedAt: session.updatedAt,
      };
    }),
});
