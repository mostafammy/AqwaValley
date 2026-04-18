import { and, desc, eq, gt, lte, lt, sql } from "drizzle-orm";

import type { db as DbInstance } from "~/server/db";
import { env } from "~/env";
import {
  district,
  districtPeriodConsumptionSnapshot,
  farm,
  farmPeriodConsumptionSnapshot,
  farmWell,
  quotaBreachEvent,
  quotaOverride,
} from "~/server/db/schema";

export type PeriodType = "daily" | "monthly";
export type QuotaState =
  | "ok"
  | "warning"
  | "critical"
  | "exceeded"
  | "needs_review";
export type TrendDirection = "increase" | "decrease" | "flat";

export type QuotaDecision = {
  scope: "farm" | "district";
  scopeId: string;
  districtId: string;
  periodType: PeriodType;
  periodStart: Date;
  periodEnd: Date;
  quotaM3: number;
  consumptionM3: number;
  utilizationPct: number;
  baselineConsumptionM3: number | null;
  trendDirection: TrendDirection;
  trendDeltaPct: number | null;
  rawState: QuotaState;
  effectiveState: QuotaState;
  reasons: string[];
  dataQualityFlag: string | null;
};

type Db = typeof DbInstance;

type DecisionInput = {
  quotaM3: number;
  consumptionM3: number;
  baselineConsumptionM3: number | null;
  hasQualityIssue: boolean;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function getPeriodBounds(
  periodType: PeriodType,
  anchor?: Date,
): {
  periodStart: Date;
  periodEnd: Date;
} {
  const base = anchor ? new Date(anchor) : new Date();
  const periodStart = new Date(base);
  const periodEnd = new Date(base);

  if (periodType === "daily") {
    periodStart.setUTCHours(0, 0, 0, 0);
    periodEnd.setUTCDate(periodStart.getUTCDate() + 1);
    return { periodStart, periodEnd };
  }

  periodStart.setUTCDate(1);
  periodStart.setUTCHours(0, 0, 0, 0);
  periodEnd.setUTCMonth(periodStart.getUTCMonth() + 1);
  return { periodStart, periodEnd };
}

function deriveDecision(input: DecisionInput): {
  utilizationPct: number;
  trendDirection: TrendDirection;
  trendDeltaPct: number | null;
  rawState: QuotaState;
  reasons: string[];
} {
  const reasons: string[] = [];

  if (input.hasQualityIssue) {
    reasons.push("allocation_integrity_warning");
  }

  if (input.quotaM3 <= 0) {
    reasons.push("missing_or_zero_quota");
    return {
      utilizationPct: 0,
      trendDirection: "flat",
      trendDeltaPct: null,
      rawState: "needs_review",
      reasons,
    };
  }

  const utilizationPct = round2((input.consumptionM3 / input.quotaM3) * 100);

  let trendDirection: TrendDirection = "flat";
  let trendDeltaPct: number | null = null;

  if (input.baselineConsumptionM3 != null) {
    if (input.baselineConsumptionM3 === 0) {
      trendDeltaPct = input.consumptionM3 > 0 ? 100 : 0;
    } else {
      trendDeltaPct = round2(
        ((input.consumptionM3 - input.baselineConsumptionM3) /
          input.baselineConsumptionM3) *
          100,
      );
    }

    if (trendDeltaPct > 2) trendDirection = "increase";
    else if (trendDeltaPct < -2) trendDirection = "decrease";
  }

  let rawState: QuotaState = "ok";
  if (input.hasQualityIssue) rawState = "needs_review";
  else if (utilizationPct > 100) rawState = "exceeded";
  else if (utilizationPct >= env.QUOTA_CRITICAL_THRESHOLD_PCT)
    rawState = "critical";
  else if (utilizationPct >= env.QUOTA_WARNING_THRESHOLD_PCT)
    rawState = "warning";

  reasons.push(`utilization_${rawState}`);

  return {
    utilizationPct,
    trendDirection,
    trendDeltaPct,
    rawState,
    reasons,
  };
}

async function resolveEffectiveState(
  db: Db,
  scopeType: "farm" | "district",
  districtId: string,
  rawState: QuotaState,
  farmId?: string,
): Promise<QuotaState> {
  const now = new Date();

  const currentOverride = await db
    .select({ stateOverride: quotaOverride.stateOverride })
    .from(quotaOverride)
    .where(
      and(
        eq(quotaOverride.scopeType, scopeType),
        scopeType === "farm" && farmId
          ? eq(quotaOverride.farmId, farmId)
          : eq(quotaOverride.districtId, districtId),
        eq(quotaOverride.status, "active"),
        lte(quotaOverride.startAt, now),
        gt(quotaOverride.endAt, now),
      ),
    )
    .orderBy(desc(quotaOverride.createdAt))
    .limit(1);

  return currentOverride[0]?.stateOverride ?? rawState;
}

async function maybeCreateBreachEvent(
  db: Db,
  decision: QuotaDecision,
): Promise<void> {
  if (!["warning", "critical", "exceeded"].includes(decision.rawState)) {
    return;
  }

  const existing = await db
    .select({ id: quotaBreachEvent.id })
    .from(quotaBreachEvent)
    .where(
      and(
        eq(quotaBreachEvent.scopeType, decision.scope),
        decision.scope === "farm"
          ? eq(quotaBreachEvent.farmId, decision.scopeId)
          : eq(quotaBreachEvent.districtId, decision.scopeId),
        eq(quotaBreachEvent.periodType, decision.periodType),
        eq(quotaBreachEvent.periodStart, decision.periodStart),
        eq(quotaBreachEvent.rawState, decision.rawState),
        eq(quotaBreachEvent.status, "open"),
      ),
    )
    .limit(1);

  if (existing[0]) return;

  await db.insert(quotaBreachEvent).values({
    scopeType: decision.scope,
    farmId: decision.scope === "farm" ? decision.scopeId : null,
    districtId: decision.districtId,
    periodType: decision.periodType,
    periodStart: decision.periodStart,
    periodEnd: decision.periodEnd,
    rawState: decision.rawState,
    effectiveState: decision.effectiveState,
    quotaM3: String(decision.quotaM3),
    consumptionM3: String(decision.consumptionM3),
    utilizationPct: String(decision.utilizationPct),
    deltaM3: String(round2(decision.consumptionM3 - decision.quotaM3)),
    reasonCodes: decision.reasons,
    message: `${decision.scope} quota ${decision.rawState}`,
  });
}

async function getFarmConsumptionM3(
  db: Db,
  farmId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  const sensorRows = await db.execute(sql`
    SELECT COALESCE(SUM(sd.value * (fw.allocation_pct::numeric / 100)), 0) AS consumption
    FROM sensor_data sd
    INNER JOIN sensors s ON s.id = sd.sensor_id
    INNER JOIN farm_well fw ON fw.well_id = s.well_id
    WHERE fw.farm_id = ${farmId}::uuid
      AND s.type = 'flow_rate'
      AND sd.timestamp >= ${periodStart.toISOString()}::timestamptz
      AND sd.timestamp < ${periodEnd.toISOString()}::timestamptz
  `);

  const eventRows = await db.execute(sql`
    SELECT COALESCE(SUM(ie.actual_consumption_m3), 0) AS consumption
    FROM irrigation_event ie
    WHERE ie.farm_id = ${farmId}::uuid
      AND ie.actual_consumption_m3 IS NOT NULL
      AND ie.started_at >= ${periodStart.toISOString()}::timestamptz
      AND ie.started_at < ${periodEnd.toISOString()}::timestamptz
  `);

  const sessionRows = await db.execute(sql`
    SELECT COALESCE(SUM(isess.liters_pumped::numeric / 1000), 0) AS consumption
    FROM irrigation_session isess
    WHERE isess.farm_id = ${farmId}::uuid
      AND isess.updated_at >= ${periodStart.toISOString()}::timestamptz
      AND isess.updated_at < ${periodEnd.toISOString()}::timestamptz
  `);

  const sensorConsumption = Number((sensorRows[0] as Record<string, unknown> | undefined)?.consumption ?? 0);
  const eventConsumption = Number((eventRows[0] as Record<string, unknown> | undefined)?.consumption ?? 0);
  const sessionConsumption = Number((sessionRows[0] as Record<string, unknown> | undefined)?.consumption ?? 0);

  return round2(sensorConsumption + eventConsumption + sessionConsumption);
}

async function getDistrictConsumptionM3(
  db: Db,
  districtId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  const sensorRows = await db.execute(sql`
    SELECT COALESCE(SUM(sd.value), 0) AS consumption
    FROM sensor_data sd
    INNER JOIN sensors s ON s.id = sd.sensor_id
    INNER JOIN well w ON w.id = s.well_id
    WHERE w.district_id = ${districtId}::uuid
      AND s.type = 'flow_rate'
      AND sd.timestamp >= ${periodStart.toISOString()}::timestamptz
      AND sd.timestamp < ${periodEnd.toISOString()}::timestamptz
  `);

  const eventRows = await db.execute(sql`
    SELECT COALESCE(SUM(ie.actual_consumption_m3), 0) AS consumption
    FROM irrigation_event ie
    INNER JOIN farm f ON f.id = ie.farm_id
    WHERE f.district_id = ${districtId}::uuid
      AND ie.actual_consumption_m3 IS NOT NULL
      AND ie.started_at >= ${periodStart.toISOString()}::timestamptz
      AND ie.started_at < ${periodEnd.toISOString()}::timestamptz
  `);

  const sessionRows = await db.execute(sql`
    SELECT COALESCE(SUM(isess.liters_pumped::numeric / 1000), 0) AS consumption
    FROM irrigation_session isess
    INNER JOIN farm f ON f.id = isess.farm_id
    WHERE f.district_id = ${districtId}::uuid
      AND isess.updated_at >= ${periodStart.toISOString()}::timestamptz
      AND isess.updated_at < ${periodEnd.toISOString()}::timestamptz
  `);

  const sensorConsumption = Number((sensorRows[0] as Record<string, unknown> | undefined)?.consumption ?? 0);
  const eventConsumption = Number((eventRows[0] as Record<string, unknown> | undefined)?.consumption ?? 0);
  const sessionConsumption = Number((sessionRows[0] as Record<string, unknown> | undefined)?.consumption ?? 0);

  return round2(sensorConsumption + eventConsumption + sessionConsumption);
}

async function getFarmBaselineM3(
  db: Db,
  farmId: string,
  periodType: PeriodType,
  periodStart: Date,
  baselineWindow: number,
): Promise<number | null> {
  const rows = await db
    .select({ consumptionM3: farmPeriodConsumptionSnapshot.consumptionM3 })
    .from(farmPeriodConsumptionSnapshot)
    .where(
      and(
        eq(farmPeriodConsumptionSnapshot.farmId, farmId),
        eq(farmPeriodConsumptionSnapshot.periodType, periodType),
        lt(farmPeriodConsumptionSnapshot.periodStart, periodStart),
      ),
    )
    .orderBy(desc(farmPeriodConsumptionSnapshot.periodStart))
    .limit(Math.max(1, baselineWindow));

  if (!rows.length) return null;

  const sum = rows.reduce(
    (acc, row) => acc + Number(row.consumptionM3 ?? 0),
    0,
  );
  return round2(sum / rows.length);
}

async function getDistrictBaselineM3(
  db: Db,
  districtId: string,
  periodType: PeriodType,
  periodStart: Date,
  baselineWindow: number,
): Promise<number | null> {
  const rows = await db
    .select({ consumptionM3: districtPeriodConsumptionSnapshot.consumptionM3 })
    .from(districtPeriodConsumptionSnapshot)
    .where(
      and(
        eq(districtPeriodConsumptionSnapshot.districtId, districtId),
        eq(districtPeriodConsumptionSnapshot.periodType, periodType),
        lt(districtPeriodConsumptionSnapshot.periodStart, periodStart),
      ),
    )
    .orderBy(desc(districtPeriodConsumptionSnapshot.periodStart))
    .limit(Math.max(1, baselineWindow));

  if (!rows.length) return null;

  const sum = rows.reduce(
    (acc, row) => acc + Number(row.consumptionM3 ?? 0),
    0,
  );
  return round2(sum / rows.length);
}

async function isFarmAllocationOutOfRange(
  db: Db,
  farmId: string,
): Promise<boolean> {
  const allocation = await db
    .select({
      total: sql<number>`COALESCE(SUM(${farmWell.allocationPct}::numeric), 0)`,
    })
    .from(farmWell)
    .where(eq(farmWell.farmId, farmId));

  const total = Number(allocation[0]?.total ?? 0);
  return total > 0 && Math.abs(total - 100) > 0.5;
}

function resolveFarmQuota(
  periodType: PeriodType,
  monthlyQuota: number,
  annualQuota: number,
): number {
  if (periodType === "monthly") return monthlyQuota;
  if (monthlyQuota > 0) return round2(monthlyQuota / 30);
  return round2(annualQuota / 365);
}

function resolveDistrictQuota(
  periodType: PeriodType,
  safeYieldM3Yr: number,
): number {
  if (periodType === "monthly") return round2(safeYieldM3Yr / 12);
  return round2(safeYieldM3Yr / 365);
}

export async function computeFarmQuotaDecision(params: {
  db: Db;
  farmId: string;
  periodType: PeriodType;
  anchor?: Date;
  baselineWindow: number;
}): Promise<QuotaDecision> {
  const { db, farmId, periodType, anchor, baselineWindow } = params;
  const farmRecord = await db
    .select({
      id: farm.id,
      districtId: farm.districtId,
      monthlyQuotaM3: farm.monthlyQuotaM3,
      annualQuotaM3: farm.annualQuotaM3,
    })
    .from(farm)
    .where(eq(farm.id, farmId))
    .limit(1);

  const targetFarm = farmRecord[0];
  if (!targetFarm) {
    throw new Error("Farm not found");
  }

  const { periodStart, periodEnd } = getPeriodBounds(periodType, anchor);
  const [consumptionM3, baselineConsumptionM3, hasQualityIssue] =
    await Promise.all([
      getFarmConsumptionM3(db, farmId, periodStart, periodEnd),
      getFarmBaselineM3(db, farmId, periodType, periodStart, baselineWindow),
      isFarmAllocationOutOfRange(db, farmId),
    ]);

  const monthlyQuota = Number(targetFarm.monthlyQuotaM3 ?? 0);
  const annualQuota = Number(targetFarm.annualQuotaM3 ?? 0);
  const quotaM3 = resolveFarmQuota(periodType, monthlyQuota, annualQuota);

  const derived = deriveDecision({
    quotaM3,
    consumptionM3,
    baselineConsumptionM3,
    hasQualityIssue,
  });

  const effectiveState = await resolveEffectiveState(
    db,
    "farm",
    targetFarm.districtId,
    derived.rawState,
    targetFarm.id,
  );

  const decision: QuotaDecision = {
    scope: "farm",
    scopeId: targetFarm.id,
    districtId: targetFarm.districtId,
    periodType,
    periodStart,
    periodEnd,
    quotaM3,
    consumptionM3: round2(consumptionM3),
    utilizationPct: derived.utilizationPct,
    baselineConsumptionM3,
    trendDirection: derived.trendDirection,
    trendDeltaPct: derived.trendDeltaPct,
    rawState: derived.rawState,
    effectiveState,
    reasons: derived.reasons,
    dataQualityFlag: hasQualityIssue ? "allocation_pct_out_of_tolerance" : null,
  };

  await db
    .insert(farmPeriodConsumptionSnapshot)
    .values({
      farmId: decision.scopeId,
      districtId: decision.districtId,
      periodType: decision.periodType,
      periodStart: decision.periodStart,
      periodEnd: decision.periodEnd,
      quotaM3: String(decision.quotaM3),
      consumptionM3: String(decision.consumptionM3),
      utilizationPct: String(decision.utilizationPct),
      baselineConsumptionM3:
        decision.baselineConsumptionM3 != null
          ? String(decision.baselineConsumptionM3)
          : null,
      trendDirection: decision.trendDirection,
      trendDeltaPct:
        decision.trendDeltaPct != null ? String(decision.trendDeltaPct) : null,
      rawState: decision.rawState,
      effectiveState: decision.effectiveState,
      dataQualityFlag: decision.dataQualityFlag,
      decisionReasons: decision.reasons,
      updatedAt: new Date(),
      computedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        farmPeriodConsumptionSnapshot.farmId,
        farmPeriodConsumptionSnapshot.periodType,
        farmPeriodConsumptionSnapshot.periodStart,
      ],
      set: {
        periodEnd: decision.periodEnd,
        quotaM3: String(decision.quotaM3),
        consumptionM3: String(decision.consumptionM3),
        utilizationPct: String(decision.utilizationPct),
        baselineConsumptionM3:
          decision.baselineConsumptionM3 != null
            ? String(decision.baselineConsumptionM3)
            : null,
        trendDirection: decision.trendDirection,
        trendDeltaPct:
          decision.trendDeltaPct != null
            ? String(decision.trendDeltaPct)
            : null,
        rawState: decision.rawState,
        effectiveState: decision.effectiveState,
        dataQualityFlag: decision.dataQualityFlag,
        decisionReasons: decision.reasons,
        updatedAt: new Date(),
        computedAt: new Date(),
      },
    });

  await maybeCreateBreachEvent(db, decision);
  return decision;
}

export async function computeDistrictQuotaDecision(params: {
  db: Db;
  districtId: string;
  periodType: PeriodType;
  anchor?: Date;
  baselineWindow: number;
}): Promise<QuotaDecision> {
  const { db, districtId, periodType, anchor, baselineWindow } = params;

  const districtRecord = await db
    .select({ id: district.id, safeYieldM3Yr: district.safeYieldM3Yr })
    .from(district)
    .where(eq(district.id, districtId))
    .limit(1);

  const targetDistrict = districtRecord[0];
  if (!targetDistrict) {
    throw new Error("District not found");
  }

  const { periodStart, periodEnd } = getPeriodBounds(periodType, anchor);
  const [consumptionM3, baselineConsumptionM3] = await Promise.all([
    getDistrictConsumptionM3(db, districtId, periodStart, periodEnd),
    getDistrictBaselineM3(
      db,
      districtId,
      periodType,
      periodStart,
      baselineWindow,
    ),
  ]);

  const quotaM3 = resolveDistrictQuota(
    periodType,
    Number(targetDistrict.safeYieldM3Yr ?? 0),
  );

  const derived = deriveDecision({
    quotaM3,
    consumptionM3,
    baselineConsumptionM3,
    hasQualityIssue: false,
  });

  const effectiveState = await resolveEffectiveState(
    db,
    "district",
    districtId,
    derived.rawState,
  );

  const decision: QuotaDecision = {
    scope: "district",
    scopeId: districtId,
    districtId,
    periodType,
    periodStart,
    periodEnd,
    quotaM3,
    consumptionM3: round2(consumptionM3),
    utilizationPct: derived.utilizationPct,
    baselineConsumptionM3,
    trendDirection: derived.trendDirection,
    trendDeltaPct: derived.trendDeltaPct,
    rawState: derived.rawState,
    effectiveState,
    reasons: derived.reasons,
    dataQualityFlag: null,
  };

  await db
    .insert(districtPeriodConsumptionSnapshot)
    .values({
      districtId: decision.scopeId,
      periodType: decision.periodType,
      periodStart: decision.periodStart,
      periodEnd: decision.periodEnd,
      quotaM3: String(decision.quotaM3),
      consumptionM3: String(decision.consumptionM3),
      utilizationPct: String(decision.utilizationPct),
      baselineConsumptionM3:
        decision.baselineConsumptionM3 != null
          ? String(decision.baselineConsumptionM3)
          : null,
      trendDirection: decision.trendDirection,
      trendDeltaPct:
        decision.trendDeltaPct != null ? String(decision.trendDeltaPct) : null,
      rawState: decision.rawState,
      effectiveState: decision.effectiveState,
      dataQualityFlag: decision.dataQualityFlag,
      decisionReasons: decision.reasons,
      updatedAt: new Date(),
      computedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        districtPeriodConsumptionSnapshot.districtId,
        districtPeriodConsumptionSnapshot.periodType,
        districtPeriodConsumptionSnapshot.periodStart,
      ],
      set: {
        periodEnd: decision.periodEnd,
        quotaM3: String(decision.quotaM3),
        consumptionM3: String(decision.consumptionM3),
        utilizationPct: String(decision.utilizationPct),
        baselineConsumptionM3:
          decision.baselineConsumptionM3 != null
            ? String(decision.baselineConsumptionM3)
            : null,
        trendDirection: decision.trendDirection,
        trendDeltaPct:
          decision.trendDeltaPct != null
            ? String(decision.trendDeltaPct)
            : null,
        rawState: decision.rawState,
        effectiveState: decision.effectiveState,
        dataQualityFlag: decision.dataQualityFlag,
        decisionReasons: decision.reasons,
        updatedAt: new Date(),
        computedAt: new Date(),
      },
    });

  await maybeCreateBreachEvent(db, decision);
  return decision;
}
