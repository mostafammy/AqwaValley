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
import { desc, eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { irrigationRecommendation, farm } from "~/server/db/schema";
import { requestIrrigationPlan } from "~/server/services/irrigation/recommend";
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

      if (!farmRecord) throw new TRPCError({ code: "NOT_FOUND" });

      const { fetchSoilReadings, fetchQuotaContext } = await import("~/server/services/irrigation/recommend_helpers");
      
      const [soilReadingMap, quota] = await Promise.all([
        fetchSoilReadings(input.farmId),
        fetchQuotaContext(input.farmId, farmRecord.monthlyQuotaM3),
      ]);

      const readings = Object.values(soilReadingMap).filter(Boolean);
      const avgSoilMoisture = readings.length > 0 
        ? readings.reduce((sum, r) => sum + r!.humidityPct, 0) / readings.length
        : null;

      return {
        avgSoilMoisture,
        remainingQuotaLitres: quota.remainingLitres,
      };
    }),
});
