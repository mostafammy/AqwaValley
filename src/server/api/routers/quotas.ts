import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  operatorProcedure,
  viewerProcedure,
} from "~/server/api/trpc";
import {
  getAccessibleDistrictIds,
  requireDistrictAccess,
  requireFarmAccess,
} from "~/server/lib/abac";
import {
  district,
  districtPeriodConsumptionSnapshot,
  farm,
  farmPeriodConsumptionSnapshot,
  quotaBreachEvent,
  quotaOverride,
} from "~/server/db/schema";
import {
  computeDistrictQuotaDecision,
  computeFarmQuotaDecision,
} from "~/server/services/quotaDecisionService";
import { env } from "~/env";

const periodTypeValues = ["daily", "monthly"] as const;
const quotaScopeTypeValues = ["farm", "district"] as const;
const quotaStateValues = [
  "ok",
  "warning",
  "critical",
  "exceeded",
  "needs_review",
] as const;
const quotaOverrideStatusValues = ["active", "revoked", "expired"] as const;
const quotaBreachStatusValues = ["open", "resolved"] as const;
const defaultBaselineWindow = Number(env.QUOTA_BASELINE_MONTH_WINDOW ?? 3);

function breachSeverityFromState(
  state: (typeof quotaStateValues)[number],
): "info" | "warning" | "critical" {
  if (state === "critical" || state === "exceeded") return "critical";
  if (state === "warning") return "warning";
  return "info";
}

export const quotasRouter = createTRPCRouter({
  farmStatus: viewerProcedure
    .input(
      z.object({
        farmId: z.string().uuid(),
        periodType: z.enum(periodTypeValues).default("monthly"),
        anchor: z.date().optional(),
        baselineWindow: z.number().int().min(1).max(24).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireFarmAccess(ctx, input.farmId);

      const decision = await computeFarmQuotaDecision({
        db: ctx.db,
        farmId: input.farmId,
        periodType: input.periodType,
        anchor: input.anchor,
        baselineWindow: input.baselineWindow ?? defaultBaselineWindow,
      });

      return decision;
    }),

  districtStatus: viewerProcedure
    .input(
      z.object({
        districtId: z.string().uuid(),
        periodType: z.enum(periodTypeValues).default("monthly"),
        anchor: z.date().optional(),
        baselineWindow: z.number().int().min(1).max(24).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireDistrictAccess(ctx, input.districtId);

      const decision = await computeDistrictQuotaDecision({
        db: ctx.db,
        districtId: input.districtId,
        periodType: input.periodType,
        anchor: input.anchor,
        baselineWindow: input.baselineWindow ?? defaultBaselineWindow,
      });

      return decision;
    }),

  farmTrend: viewerProcedure
    .input(
      z.object({
        farmId: z.string().uuid(),
        periodType: z.enum(periodTypeValues).default("monthly"),
        from: z.date(),
        to: z.date(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireFarmAccess(ctx, input.farmId);

      const rows = await ctx.db
        .select({
          periodStart: farmPeriodConsumptionSnapshot.periodStart,
          periodEnd: farmPeriodConsumptionSnapshot.periodEnd,
          quotaM3: farmPeriodConsumptionSnapshot.quotaM3,
          consumptionM3: farmPeriodConsumptionSnapshot.consumptionM3,
          utilizationPct: farmPeriodConsumptionSnapshot.utilizationPct,
          baselineConsumptionM3:
            farmPeriodConsumptionSnapshot.baselineConsumptionM3,
          trendDirection: farmPeriodConsumptionSnapshot.trendDirection,
          trendDeltaPct: farmPeriodConsumptionSnapshot.trendDeltaPct,
          rawState: farmPeriodConsumptionSnapshot.rawState,
          effectiveState: farmPeriodConsumptionSnapshot.effectiveState,
          dataQualityFlag: farmPeriodConsumptionSnapshot.dataQualityFlag,
          computedAt: farmPeriodConsumptionSnapshot.computedAt,
        })
        .from(farmPeriodConsumptionSnapshot)
        .where(
          and(
            eq(farmPeriodConsumptionSnapshot.farmId, input.farmId),
            eq(farmPeriodConsumptionSnapshot.periodType, input.periodType),
            gte(farmPeriodConsumptionSnapshot.periodStart, input.from),
            lte(farmPeriodConsumptionSnapshot.periodStart, input.to),
          ),
        )
        .orderBy(asc(farmPeriodConsumptionSnapshot.periodStart));

      return rows;
    }),

  districtTrend: viewerProcedure
    .input(
      z.object({
        districtId: z.string().uuid(),
        periodType: z.enum(periodTypeValues).default("monthly"),
        from: z.date(),
        to: z.date(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireDistrictAccess(ctx, input.districtId);

      const rows = await ctx.db
        .select({
          periodStart: districtPeriodConsumptionSnapshot.periodStart,
          periodEnd: districtPeriodConsumptionSnapshot.periodEnd,
          quotaM3: districtPeriodConsumptionSnapshot.quotaM3,
          consumptionM3: districtPeriodConsumptionSnapshot.consumptionM3,
          utilizationPct: districtPeriodConsumptionSnapshot.utilizationPct,
          baselineConsumptionM3:
            districtPeriodConsumptionSnapshot.baselineConsumptionM3,
          trendDirection: districtPeriodConsumptionSnapshot.trendDirection,
          trendDeltaPct: districtPeriodConsumptionSnapshot.trendDeltaPct,
          rawState: districtPeriodConsumptionSnapshot.rawState,
          effectiveState: districtPeriodConsumptionSnapshot.effectiveState,
          dataQualityFlag: districtPeriodConsumptionSnapshot.dataQualityFlag,
          computedAt: districtPeriodConsumptionSnapshot.computedAt,
        })
        .from(districtPeriodConsumptionSnapshot)
        .where(
          and(
            eq(districtPeriodConsumptionSnapshot.districtId, input.districtId),
            eq(districtPeriodConsumptionSnapshot.periodType, input.periodType),
            gte(districtPeriodConsumptionSnapshot.periodStart, input.from),
            lte(districtPeriodConsumptionSnapshot.periodStart, input.to),
          ),
        )
        .orderBy(asc(districtPeriodConsumptionSnapshot.periodStart));

      return rows;
    }),

  listBreaches: viewerProcedure
    .input(
      z.object({
        scopeType: z.enum(quotaScopeTypeValues).optional(),
        farmId: z.string().uuid().optional(),
        districtId: z.string().uuid().optional(),
        status: z.enum(quotaBreachStatusValues).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.farmId) await requireFarmAccess(ctx, input.farmId);
      if (input.districtId) await requireDistrictAccess(ctx, input.districtId);

      const accessibleDistricts = await getAccessibleDistrictIds(ctx);
      const offset = (input.page - 1) * input.pageSize;

      const scopedDistrictCondition =
        accessibleDistricts === null
          ? undefined
          : accessibleDistricts.length === 0
            ? sql`1 = 0`
            : inArray(quotaBreachEvent.districtId, accessibleDistricts);

      const conditions = [
        scopedDistrictCondition,
        input.scopeType
          ? eq(quotaBreachEvent.scopeType, input.scopeType)
          : undefined,
        input.farmId ? eq(quotaBreachEvent.farmId, input.farmId) : undefined,
        input.districtId
          ? eq(quotaBreachEvent.districtId, input.districtId)
          : undefined,
        input.status ? eq(quotaBreachEvent.status, input.status) : undefined,
      ].filter(Boolean);

      const [items, countResult] = await Promise.all([
        ctx.db
          .select()
          .from(quotaBreachEvent)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(quotaBreachEvent.triggeredAt))
          .limit(input.pageSize)
          .offset(offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(quotaBreachEvent)
          .where(conditions.length > 0 ? and(...conditions) : undefined),
      ]);

      return {
        items,
        total: Number(countResult[0]?.count ?? 0),
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  listQuotaAlerts: viewerProcedure
    .input(
      z.object({
        districtId: z.string().uuid().optional(),
        scopeType: z.enum(quotaScopeTypeValues).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.districtId) {
        await requireDistrictAccess(ctx, input.districtId);
      }

      const accessibleDistricts = await getAccessibleDistrictIds(ctx);
      const offset = (input.page - 1) * input.pageSize;

      const scopedDistrictCondition =
        accessibleDistricts === null
          ? undefined
          : accessibleDistricts.length === 0
            ? sql`1 = 0`
            : inArray(quotaBreachEvent.districtId, accessibleDistricts);

      const conditions = [
        scopedDistrictCondition,
        eq(quotaBreachEvent.status, "open"),
        input.scopeType
          ? eq(quotaBreachEvent.scopeType, input.scopeType)
          : undefined,
        input.districtId
          ? eq(quotaBreachEvent.districtId, input.districtId)
          : undefined,
      ].filter(Boolean);

      const [items, countResult] = await Promise.all([
        ctx.db
          .select({
            id: quotaBreachEvent.id,
            scopeType: quotaBreachEvent.scopeType,
            farmId: quotaBreachEvent.farmId,
            districtId: quotaBreachEvent.districtId,
            periodType: quotaBreachEvent.periodType,
            periodStart: quotaBreachEvent.periodStart,
            periodEnd: quotaBreachEvent.periodEnd,
            rawState: quotaBreachEvent.rawState,
            effectiveState: quotaBreachEvent.effectiveState,
            utilizationPct: quotaBreachEvent.utilizationPct,
            message: quotaBreachEvent.message,
            reasonCodes: quotaBreachEvent.reasonCodes,
            triggeredAt: quotaBreachEvent.triggeredAt,
          })
          .from(quotaBreachEvent)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(quotaBreachEvent.triggeredAt))
          .limit(input.pageSize)
          .offset(offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(quotaBreachEvent)
          .where(conditions.length > 0 ? and(...conditions) : undefined),
      ]);

      return {
        items: items.map((item) => ({
          ...item,
          severity: breachSeverityFromState(item.rawState),
        })),
        total: Number(countResult[0]?.count ?? 0),
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  listOverrides: viewerProcedure
    .input(
      z.object({
        scopeType: z.enum(quotaScopeTypeValues).optional(),
        farmId: z.string().uuid().optional(),
        districtId: z.string().uuid().optional(),
        status: z.enum(quotaOverrideStatusValues).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.farmId) await requireFarmAccess(ctx, input.farmId);
      if (input.districtId) await requireDistrictAccess(ctx, input.districtId);

      const accessibleDistricts = await getAccessibleDistrictIds(ctx);
      const offset = (input.page - 1) * input.pageSize;

      const scopedDistrictCondition =
        accessibleDistricts === null
          ? undefined
          : accessibleDistricts.length === 0
            ? sql`1 = 0`
            : inArray(quotaOverride.districtId, accessibleDistricts);

      const conditions = [
        scopedDistrictCondition,
        input.scopeType
          ? eq(quotaOverride.scopeType, input.scopeType)
          : undefined,
        input.farmId ? eq(quotaOverride.farmId, input.farmId) : undefined,
        input.districtId
          ? eq(quotaOverride.districtId, input.districtId)
          : undefined,
        input.status ? eq(quotaOverride.status, input.status) : undefined,
      ].filter(Boolean);

      const [items, countResult] = await Promise.all([
        ctx.db
          .select()
          .from(quotaOverride)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(quotaOverride.createdAt))
          .limit(input.pageSize)
          .offset(offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(quotaOverride)
          .where(conditions.length > 0 ? and(...conditions) : undefined),
      ]);

      return {
        items,
        total: Number(countResult[0]?.count ?? 0),
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  setFarmQuota: operatorProcedure
    .input(
      z.object({
        farmId: z.string().uuid(),
        monthlyQuotaM3: z.number().positive().optional(),
        annualQuotaM3: z.number().positive().optional(),
        reason: z.string().min(3).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireFarmAccess(ctx, input.farmId);

      if (
        input.monthlyQuotaM3 === undefined &&
        input.annualQuotaM3 === undefined
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "At least one quota field must be provided",
        });
      }

      const [updated] = await ctx.db
        .update(farm)
        .set({
          monthlyQuotaM3:
            input.monthlyQuotaM3 !== undefined
              ? String(input.monthlyQuotaM3)
              : undefined,
          annualQuotaM3:
            input.annualQuotaM3 !== undefined
              ? String(input.annualQuotaM3)
              : undefined,
          updatedAt: new Date(),
        })
        .where(eq(farm.id, input.farmId))
        .returning({
          id: farm.id,
          monthlyQuotaM3: farm.monthlyQuotaM3,
          annualQuotaM3: farm.annualQuotaM3,
          updatedAt: farm.updatedAt,
        });

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Farm not found" });
      }

      return {
        ...updated,
        reason: input.reason,
      };
    }),

  setDistrictQuota: operatorProcedure
    .input(
      z.object({
        districtId: z.string().uuid(),
        safeYieldM3Yr: z.number().positive(),
        warningThresholdPct: z.number().min(1).max(100).optional(),
        criticalThresholdPct: z.number().min(1).max(120).optional(),
        reason: z.string().min(3).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireDistrictAccess(ctx, input.districtId);

      if (
        input.warningThresholdPct != null &&
        input.criticalThresholdPct != null &&
        input.warningThresholdPct >= input.criticalThresholdPct
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "warningThresholdPct must be less than criticalThresholdPct",
        });
      }

      const [updated] = await ctx.db
        .update(district)
        .set({
          safeYieldM3Yr: String(input.safeYieldM3Yr),
          warningThresholdPct:
            input.warningThresholdPct != null
              ? String(input.warningThresholdPct)
              : undefined,
          criticalThresholdPct:
            input.criticalThresholdPct != null
              ? String(input.criticalThresholdPct)
              : undefined,
          updatedAt: new Date(),
        })
        .where(eq(district.id, input.districtId))
        .returning({
          id: district.id,
          safeYieldM3Yr: district.safeYieldM3Yr,
          warningThresholdPct: district.warningThresholdPct,
          criticalThresholdPct: district.criticalThresholdPct,
          updatedAt: district.updatedAt,
        });

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "District not found",
        });
      }

      return {
        ...updated,
        reason: input.reason,
      };
    }),

  createOverride: operatorProcedure
    .input(
      z
        .object({
          scopeType: z.enum(quotaScopeTypeValues),
          farmId: z.string().uuid().optional(),
          districtId: z.string().uuid().optional(),
          stateOverride: z.enum(quotaStateValues),
          reason: z.string().min(3).max(500),
          startAt: z.date(),
          endAt: z.date(),
        })
        .refine((input) => input.endAt > input.startAt, {
          message: "endAt must be after startAt",
          path: ["endAt"],
        })
        .refine(
          (input) =>
            input.scopeType === "farm"
              ? Boolean(input.farmId)
              : Boolean(input.districtId),
          {
            message: "Scope id is required for the selected scopeType",
            path: ["scopeType"],
          },
        ),
    )
    .mutation(async ({ ctx, input }) => {
      let districtId = input.districtId;

      if (input.scopeType === "farm") {
        if (!input.farmId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "farmId required",
          });
        }
        await requireFarmAccess(ctx, input.farmId);

        const farmRecord = await ctx.db
          .select({ districtId: farm.districtId })
          .from(farm)
          .where(eq(farm.id, input.farmId))
          .limit(1);

        districtId = farmRecord[0]?.districtId;
      } else if (districtId) {
        await requireDistrictAccess(ctx, districtId);
      }

      if (!districtId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "districtId could not be resolved",
        });
      }

      const [created] = await ctx.db
        .insert(quotaOverride)
        .values({
          scopeType: input.scopeType,
          farmId: input.scopeType === "farm" ? (input.farmId ?? null) : null,
          districtId,
          stateOverride: input.stateOverride,
          reason: input.reason,
          startAt: input.startAt,
          endAt: input.endAt,
          status: "active",
          approvedByUserId: ctx.session.user.id,
        })
        .returning();

      return created;
    }),

  revokeOverride: operatorProcedure
    .input(
      z.object({
        overrideId: z.string().uuid(),
        revokedReason: z.string().min(3).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const targetOverride = await ctx.db
        .select({
          id: quotaOverride.id,
          scopeType: quotaOverride.scopeType,
          farmId: quotaOverride.farmId,
          districtId: quotaOverride.districtId,
        })
        .from(quotaOverride)
        .where(eq(quotaOverride.id, input.overrideId))
        .limit(1);

      const item = targetOverride[0];
      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Override not found",
        });
      }

      if (item.scopeType === "farm" && item.farmId) {
        await requireFarmAccess(ctx, item.farmId);
      } else {
        await requireDistrictAccess(ctx, item.districtId);
      }

      const [updated] = await ctx.db
        .update(quotaOverride)
        .set({
          status: "revoked",
          revokedByUserId: ctx.session.user.id,
          revokedReason: input.revokedReason,
          updatedAt: new Date(),
        })
        .where(eq(quotaOverride.id, input.overrideId))
        .returning();

      return updated;
    }),
});
