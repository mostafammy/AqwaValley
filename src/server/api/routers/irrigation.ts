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
import { desc, eq, and } from "drizzle-orm";

import {
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";
import { irrigationRecommendation, farm } from "~/server/db/schema";
import { requestIrrigationPlan } from "~/server/services/irrigation/recommend";
import { TRPCError } from "@trpc/server";

// ---------------------------------------------------------------------------
// Input Schemas
// ---------------------------------------------------------------------------

const requestPlanInput = z.object({
  farmId: z.string().uuid(),
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
  ctx: { db: any; session: { user: { id: string } }; userRoles: string[] },
  farmId: string,
) {
  const farmRecord = await ctx.db
    .select({ id: farm.id, ownerId: farm.ownerId, farmerUserId: farm.farmerUserId })
    .from(farm)
    .where(eq(farm.id, farmId))
    .limit(1)
    .then((rows: any[]) => rows[0]);

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
});
