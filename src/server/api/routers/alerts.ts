import { and, count, desc, eq, gte, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  operatorProcedure,
  viewerProcedure,
} from "~/server/api/trpc";
import { requireWellAccess, buildWellDistrictFilter } from "~/server/lib/abac";
import { alertRule, alerts, sensors, well } from "~/server/db/schema";

const alertSeverityValues = ["critical", "warning", "info"] as const;
const alertTypeValues = [
  "threshold_breach",
  "anomaly",
  "sensor_offline",
] as const;
const operatorValues = ["gt", "lt", "gte", "lte", "eq"] as const;
const sensorTypeValues = [
  "water_level",
  "pressure",
  "flow_rate",
  "temperature",
  "humidity",
] as const;

export const alertsRouter = createTRPCRouter({
  /**
   * Count of unacknowledged alerts for the sidebar badge.
   */
  count: viewerProcedure.query(async ({ ctx }) => {
    const districtFilter = await buildWellDistrictFilter(ctx);
    
    // Count unacknowledged alerts scoped to accessible wells
    const [result] = await ctx.db
      .select({ count: count() })
      .from(alerts)
      .innerJoin(well, eq(well.id, alerts.wellId))
      .where(and(isNull(alerts.acknowledgedAt), districtFilter));
      
    return result?.count ?? 0;
  }),

  /**
   * Paginated list of alerts, scoped to accessible wells.
   */
  list: viewerProcedure
    .input(
      z.object({
        wellId: z.string().uuid().optional(),
        severity: z.enum(alertSeverityValues).optional(),
        type: z.enum(alertTypeValues).optional(),
        acknowledged: z.boolean().optional(),
        from: z.date().optional(),
        to: z.date().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const districtFilter = input.wellId
        ? undefined
        : await buildWellDistrictFilter(ctx);

      const conditions = [
        input.wellId ? eq(alerts.wellId, input.wellId) : districtFilter,
        input.severity ? eq(alerts.severity, input.severity) : undefined,
        input.type ? eq(alerts.type, input.type) : undefined,
        input.acknowledged === true
          ? isNotNull(alerts.acknowledgedAt)
          : undefined,
        input.acknowledged === false
          ? isNull(alerts.acknowledgedAt)
          : undefined,
        input.from ? gte(alerts.createdAt, input.from) : undefined,
        input.to ? lte(alerts.createdAt, input.to) : undefined,
      ].filter(Boolean);

      // If a wellId is provided, enforce access
      if (input.wellId) await requireWellAccess(ctx, input.wellId);

      const offset = (input.page - 1) * input.pageSize;

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const [items, countResult] = districtFilter
        ? await Promise.all([
            ctx.db
              .select({ alert: alerts })
              .from(alerts)
              .innerJoin(well, eq(well.id, alerts.wellId))
              .where(whereClause)
              .orderBy(desc(alerts.createdAt))
              .limit(input.pageSize)
              .offset(offset)
              .then((rows) => rows.map((row) => row.alert)),
            ctx.db
              .select({ count: sql<number>`count(*)` })
              .from(alerts)
              .innerJoin(well, eq(well.id, alerts.wellId))
              .where(whereClause),
          ])
        : await Promise.all([
            ctx.db
              .select()
              .from(alerts)
              .where(whereClause)
              .orderBy(desc(alerts.createdAt))
              .limit(input.pageSize)
              .offset(offset),
            ctx.db
              .select({ count: sql<number>`count(*)` })
              .from(alerts)
              .where(whereClause),
          ]);

      return {
        items,
        total: Number(countResult[0]?.count ?? 0),
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  /**
   * Acknowledge an alert (marks it as reviewed).
   */
  acknowledge: operatorProcedure
    .input(z.object({ alertId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [record] = await ctx.db
        .select({ wellId: alerts.wellId })
        .from(alerts)
        .where(eq(alerts.id, input.alertId))
        .limit(1);

      if (!record) throw new TRPCError({ code: "NOT_FOUND" });
      await requireWellAccess(ctx, record.wellId);

      const [updated] = await ctx.db
        .update(alerts)
        .set({
          acknowledgedAt: new Date(),
          acknowledgedByUserId: ctx.session.user.id,
        })
        .where(eq(alerts.id, input.alertId))
        .returning();

      return updated;
    }),

  // ─── Alert Rules Sub-router ───────────────────────────────────────────────

  rules: createTRPCRouter({
    /**
     * List all alert rules for a well.
     */
    list: viewerProcedure
      .input(
        z.object({
          wellId: z.string().uuid(),
          includeInactive: z.boolean().default(false),
        }),
      )
      .query(async ({ ctx, input }) => {
        await requireWellAccess(ctx, input.wellId);

        const conditions = [eq(alertRule.wellId, input.wellId)];
        if (!input.includeInactive)
          conditions.push(eq(alertRule.isActive, true));

        return ctx.db
          .select()
          .from(alertRule)
          .where(and(...conditions))
          .orderBy(alertRule.createdAt);
      }),

    /**
     * Create a new configurable threshold rule for a well + sensor type.
     */
    create: operatorProcedure
      .input(
        z.object({
          wellId: z.string().uuid(),
          sensorType: z.enum(sensorTypeValues),
          operator: z.enum(operatorValues),
          threshold: z.number(),
          severity: z.enum(alertSeverityValues),
          suppressionWindowMinutes: z
            .number()
            .int()
            .min(1)
            .max(1440)
            .default(15),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await requireWellAccess(ctx, input.wellId);

        const [created] = await ctx.db
          .insert(alertRule)
          .values({
            wellId: input.wellId,
            sensorType: input.sensorType,
            operator: input.operator,
            threshold: input.threshold,
            severity: input.severity,
            suppressionWindowMinutes: input.suppressionWindowMinutes,
            isActive: true,
            createdByUserId: ctx.session.user.id,
          })
          .returning();

        return created;
      }),

    /**
     * Update a rule's threshold, severity, or suppression window.
     */
    update: operatorProcedure
      .input(
        z.object({
          ruleId: z.string().uuid(),
          threshold: z.number().optional(),
          severity: z.enum(alertSeverityValues).optional(),
          suppressionWindowMinutes: z
            .number()
            .int()
            .min(1)
            .max(1440)
            .optional(),
          isActive: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const [rule] = await ctx.db
          .select({ wellId: alertRule.wellId })
          .from(alertRule)
          .where(eq(alertRule.id, input.ruleId))
          .limit(1);

        if (!rule) throw new TRPCError({ code: "NOT_FOUND" });
        await requireWellAccess(ctx, rule.wellId);

        const { ruleId, ...fields } = input;

        const [updated] = await ctx.db
          .update(alertRule)
          .set({ ...fields, updatedAt: new Date() })
          .where(eq(alertRule.id, ruleId))
          .returning();

        return updated;
      }),

    /**
     * Deactivate (soft-delete) an alert rule.
     */
    delete: operatorProcedure
      .input(z.object({ ruleId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const [rule] = await ctx.db
          .select({ wellId: alertRule.wellId })
          .from(alertRule)
          .where(eq(alertRule.id, input.ruleId))
          .limit(1);

        if (!rule) throw new TRPCError({ code: "NOT_FOUND" });
        await requireWellAccess(ctx, rule.wellId);

        await ctx.db
          .update(alertRule)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(alertRule.id, input.ruleId));

        return { success: true };
      }),
  }),
});
