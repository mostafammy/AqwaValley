import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import {
  adminProcedure,
  createTRPCRouter,
  operatorProcedure,
  viewerProcedure,
} from "~/server/api/trpc";
import {
  buildWellDistrictFilter,
  getAccessibleDistrictIds,
  requireDistrictAccess,
  requireWellAccess,
} from "~/server/lib/abac";
import {
  alerts,
  district,
  latestSensorState,
  sensors,
  well,
  wellStatusHistory,
} from "~/server/db/schema";

// ─── Input Schemas ──────────────────────────────────────────────────────────

const wellStatusValues = [
  "active",
  "inactive",
  "maintenance",
  "offline",
  "restricted",
] as const;

const valveStateValues = ["open", "closed", "partially_open", "auto"] as const;

// ─── Router ─────────────────────────────────────────────────────────────────

export const wellsRouter = createTRPCRouter({
  /**
   * Create a new well within a district.
   * The requester must have operator-level access to the target district.
   */
  create: operatorProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        districtId: z.string().uuid(),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        depthM: z.number().positive().optional(),
        status: z.enum(wellStatusValues).default("active"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireDistrictAccess(ctx, input.districtId);

      const [created] = await ctx.db
        .insert(well)
        .values({
          name: input.name,
          districtId: input.districtId,
          latitude: String(input.latitude),
          longitude: String(input.longitude),
          depthM: input.depthM != null ? String(input.depthM) : null,
          status: input.status,
        })
        .returning();

      if (!created) throw new Error("Well creation failed unexpectedly");

      // Write the initial status history entry
      await ctx.db.insert(wellStatusHistory).values({
        wellId: created.id,
        changedBy: ctx.session.user.id,
        toStatus: input.status,
        reason: "Well created",
      });

      return created;
    }),

  /**
   * Paginated list of wells, ABAC-scoped to accessible districts.
   */
  list: viewerProcedure
    .input(
      z.object({
        districtId: z.string().uuid().optional(),
        status: z.enum(wellStatusValues).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const districtFilter = await buildWellDistrictFilter(
        ctx,
        input.districtId ? [input.districtId] : undefined,
      );

      const conditions = [
        districtFilter,
        input.status ? eq(well.status, input.status) : undefined,
      ].filter(Boolean);

      const offset = (input.page - 1) * input.pageSize;

      const [items, countResult] = await Promise.all([
        ctx.db
          .select({
            id: well.id,
            name: well.name,
            districtId: well.districtId,
            latitude: well.latitude,
            longitude: well.longitude,
            depthM: well.depthM,
            status: well.status,
            hasSensor: well.hasSensor,
            valveState: well.valveState,
            currentLevelPct: well.currentLevelPct,
            createdAt: well.createdAt,
            updatedAt: well.updatedAt,
          })
          .from(well)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(asc(well.name))
          .limit(input.pageSize)
          .offset(offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(well)
          .where(conditions.length > 0 ? and(...conditions) : undefined),
      ]);

      return {
        items,
        total: Number(countResult[0]?.count ?? 0),
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  /**
   * Fetch a single well with its sensors, latest sensor states, and recent alerts.
   */
  getById: viewerProcedure
    .input(z.object({ wellId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireWellAccess(ctx, input.wellId);

      const [wellRecord] = await ctx.db
        .select()
        .from(well)
        .where(eq(well.id, input.wellId))
        .limit(1);

      if (!wellRecord) {
        const { TRPCError } = await import("@trpc/server");
        throw new TRPCError({ code: "NOT_FOUND", message: "Well not found" });
      }

      const [sensorList, latestStates, recentAlerts] = await Promise.all([
        ctx.db
          .select()
          .from(sensors)
          .where(
            and(eq(sensors.wellId, input.wellId), eq(sensors.isActive, true)),
          ),
        ctx.db
          .select()
          .from(latestSensorState)
          .where(eq(latestSensorState.wellId, input.wellId)),
        ctx.db
          .select()
          .from(alerts)
          .where(eq(alerts.wellId, input.wellId))
          .orderBy(desc(alerts.createdAt))
          .limit(10),
      ]);

      return {
        ...wellRecord,
        sensors: sensorList,
        latestStates,
        recentAlerts,
      };
    }),

  /**
   * Update well metadata. Status changes are automatically recorded in history.
   */
  update: operatorProcedure
    .input(
      z.object({
        wellId: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        depthM: z.number().positive().nullable().optional(),
        status: z.enum(wellStatusValues).optional(),
        baselineFlowRateM3Hr: z.number().positive().nullable().optional(),
        maxFlowRateM3Hr: z.number().positive().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireWellAccess(ctx, input.wellId);

      const { wellId, status, ...rest } = input;

      // Fetch current well to detect status changes
      const [current] = await ctx.db
        .select({ status: well.status })
        .from(well)
        .where(eq(well.id, wellId))
        .limit(1);

      if (!current) {
        const { TRPCError } = await import("@trpc/server");
        throw new TRPCError({ code: "NOT_FOUND", message: "Well not found" });
      }

      const updateValues: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (rest.name !== undefined) updateValues.name = rest.name;
      if (rest.depthM !== undefined)
        updateValues.depthM = rest.depthM !== null ? String(rest.depthM) : null;
      if (rest.baselineFlowRateM3Hr !== undefined)
        updateValues.baselineFlowRateM3Hr =
          rest.baselineFlowRateM3Hr !== null
            ? String(rest.baselineFlowRateM3Hr)
            : null;
      if (rest.maxFlowRateM3Hr !== undefined)
        updateValues.maxFlowRateM3Hr =
          rest.maxFlowRateM3Hr !== null ? String(rest.maxFlowRateM3Hr) : null;
      if (status !== undefined) updateValues.status = status;

      const [updated] = await ctx.db
        .update(well)
        .set(updateValues)
        .where(eq(well.id, wellId))
        .returning();

      // Record status transition if status actually changed
      if (status && status !== current.status) {
        await ctx.db.insert(wellStatusHistory).values({
          wellId,
          changedBy: ctx.session.user.id,
          fromStatus: current.status,
          toStatus: status,
          reason: `Status changed to ${status}`,
        });
      }

      return updated;
    }),

  /**
   * Change the valve state and log it as an audit event.
   */
  updateValveState: operatorProcedure
    .input(
      z.object({
        wellId: z.string().uuid(),
        valveState: z.enum(valveStateValues),
        reason: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireWellAccess(ctx, input.wellId);

      const [updated] = await ctx.db
        .update(well)
        .set({ valveState: input.valveState, updatedAt: new Date() })
        .where(eq(well.id, input.wellId))
        .returning();

      await ctx.db.insert(wellStatusHistory).values({
        wellId: input.wellId,
        changedBy: ctx.session.user.id,
        toStatus: updated!.status,
        reason: `Valve set to ${input.valveState}${input.reason ? `: ${input.reason}` : ""}`,
      });

      return updated;
    }),

  /**
   * Soft-delete a well (admin only). Sets status to inactive — data is preserved.
   */
  delete: adminProcedure
    .input(
      z.object({ wellId: z.string().uuid(), reason: z.string().optional() }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireWellAccess(ctx, input.wellId);

      const [current] = await ctx.db
        .select({ status: well.status })
        .from(well)
        .where(eq(well.id, input.wellId))
        .limit(1);

      await ctx.db
        .update(well)
        .set({ status: "inactive", updatedAt: new Date() })
        .where(eq(well.id, input.wellId));

      await ctx.db.insert(wellStatusHistory).values({
        wellId: input.wellId,
        changedBy: ctx.session.user.id,
        fromStatus: current?.status,
        toStatus: "inactive",
        reason: input.reason ?? "Well deactivated",
      });

      return { success: true };
    }),

  /**
   * Paginated audit trail of well state changes.
   */
  statusHistory: viewerProcedure
    .input(
      z.object({
        wellId: z.string().uuid(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireWellAccess(ctx, input.wellId);

      const offset = (input.page - 1) * input.pageSize;

      const [items, countResult] = await Promise.all([
        ctx.db
          .select()
          .from(wellStatusHistory)
          .where(eq(wellStatusHistory.wellId, input.wellId))
          .orderBy(desc(wellStatusHistory.changedAt))
          .limit(input.pageSize)
          .offset(offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(wellStatusHistory)
          .where(eq(wellStatusHistory.wellId, input.wellId)),
      ]);

      return {
        items,
        total: Number(countResult[0]?.count ?? 0),
        page: input.page,
        pageSize: input.pageSize,
      };
    }),
});
