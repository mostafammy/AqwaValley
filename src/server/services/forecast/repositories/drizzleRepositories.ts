import { and, desc, eq, gt, isNull, lte, or } from "drizzle-orm";

import type { db as DbInstance } from "~/server/db";
import {
  aquiferExternalReferenceObservation,
  aquiferForecastRun,
  aquiferLinearRegressionModel,
  aquiferModelReferenceObservationLink,
  aquiferRiskFlag,
} from "~/server/db/schema";
import type {
  ForecastRunClaimResult,
  ForecastArtifactRepository,
  ForecastRepositoryDb,
  PersistedForecastRun,
} from "~/server/services/forecast/repositories/ForecastArtifactRepository";
import type {
  ModelVersionRepository,
  PersistedModelVersion,
} from "~/server/services/forecast/repositories/ModelVersionRepository";
import type {
  PersistedRiskFlag,
  RiskFlagRepository,
} from "~/server/services/forecast/repositories/RiskFlagRepository";
import type { ForecastRunDraft } from "~/server/services/forecast/types";

type Db = typeof DbInstance;

export class DrizzleForecastArtifactRepository implements ForecastArtifactRepository {
  public constructor(private readonly db: Db) {}

  public async createOrClaimRun(
    draft: ForecastRunDraft,
  ): Promise<ForecastRunClaimResult> {
    const inserted = await this.db
      .insert(aquiferForecastRun)
      .values({
        runKey: draft.runKey,
        triggerType: draft.triggerType,
        scopeType: draft.scopeType,
        scopeIds: draft.scopeIds,
        status: "running",
        startedAt: draft.triggeredAt,
      })
      .onConflictDoNothing({ target: aquiferForecastRun.runKey })
      .returning({
        runKey: aquiferForecastRun.runKey,
        triggerType: aquiferForecastRun.triggerType,
        scopeType: aquiferForecastRun.scopeType,
        scopeIds: aquiferForecastRun.scopeIds,
        startedAt: aquiferForecastRun.startedAt,
        status: aquiferForecastRun.status,
        completedAt: aquiferForecastRun.completedAt,
        durationMs: aquiferForecastRun.durationMs,
        errorSummary: aquiferForecastRun.errorSummary,
      });

    const insertedRow = inserted[0];
    if (insertedRow) {
      return {
        state: "claimed",
        run: insertedRow,
      };
    }

    const existing = await this.findRun(draft.runKey);
    if (!existing) {
      throw new Error("Failed to claim or fetch forecast run");
    }

    if (existing.status === "completed") {
      return {
        state: "completed",
        run: existing,
      };
    }

    return {
      state: "already_claimed",
      run: existing,
    };
  }

  public async createRun(
    draft: ForecastRunDraft,
  ): Promise<PersistedForecastRun> {
    const inserted = await this.db
      .insert(aquiferForecastRun)
      .values({
        runKey: draft.runKey,
        triggerType: draft.triggerType,
        scopeType: draft.scopeType,
        scopeIds: draft.scopeIds,
        status: "running",
        startedAt: draft.triggeredAt,
      })
      .onConflictDoNothing({ target: aquiferForecastRun.runKey })
      .returning({
        runKey: aquiferForecastRun.runKey,
        triggerType: aquiferForecastRun.triggerType,
        scopeType: aquiferForecastRun.scopeType,
        scopeIds: aquiferForecastRun.scopeIds,
        startedAt: aquiferForecastRun.startedAt,
        status: aquiferForecastRun.status,
        completedAt: aquiferForecastRun.completedAt,
        durationMs: aquiferForecastRun.durationMs,
        errorSummary: aquiferForecastRun.errorSummary,
      });

    const row = inserted[0] ?? (await this.findRun(draft.runKey));
    if (!row) {
      throw new Error("Failed to create or fetch forecast run");
    }

    return row;
  }

  public async markRunCompleted(args: {
    runKey: string;
    durationMs: number;
  }): Promise<void> {
    await this.db
      .update(aquiferForecastRun)
      .set({
        status: "completed",
        durationMs: args.durationMs,
        completedAt: new Date(),
      })
      .where(eq(aquiferForecastRun.runKey, args.runKey));
  }

  public async markRunFailed(args: {
    runKey: string;
    errorSummary: string;
  }): Promise<void> {
    await this.db
      .update(aquiferForecastRun)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorSummary: args.errorSummary,
      })
      .where(eq(aquiferForecastRun.runKey, args.runKey));
  }

  public async findRun(runKey: string): Promise<PersistedForecastRun | null> {
    const rows = await this.db
      .select({
        runKey: aquiferForecastRun.runKey,
        triggerType: aquiferForecastRun.triggerType,
        scopeType: aquiferForecastRun.scopeType,
        scopeIds: aquiferForecastRun.scopeIds,
        startedAt: aquiferForecastRun.startedAt,
        status: aquiferForecastRun.status,
        completedAt: aquiferForecastRun.completedAt,
        durationMs: aquiferForecastRun.durationMs,
        errorSummary: aquiferForecastRun.errorSummary,
      })
      .from(aquiferForecastRun)
      .where(eq(aquiferForecastRun.runKey, runKey))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return {
      runKey: row.runKey,
      triggerType: row.triggerType,
      scopeType: row.scopeType,
      scopeIds: row.scopeIds,
      startedAt: row.startedAt,
      status: row.status,
      completedAt: row.completedAt,
      durationMs: row.durationMs,
      errorSummary: row.errorSummary,
    };
  }
}

export class DrizzleModelVersionRepository implements ModelVersionRepository {
  public constructor(private readonly db: Db) {}

  public async findEligibleModel(args: {
    scopeType: PersistedModelVersion["scopeType"];
    scopeId: string;
    targetType: PersistedModelVersion["targetType"];
    at: Date;
  }): Promise<PersistedModelVersion | null> {
    const rows = await this.db
      .select({
        id: aquiferLinearRegressionModel.id,
        scopeType: aquiferLinearRegressionModel.scopeType,
        scopeId: aquiferLinearRegressionModel.scopeId,
        targetType: aquiferLinearRegressionModel.targetType,
        slope: aquiferLinearRegressionModel.slope,
        intercept: aquiferLinearRegressionModel.intercept,
        sampleCount: aquiferLinearRegressionModel.sampleCount,
        trainingWindowStart: aquiferLinearRegressionModel.trainingWindowStart,
        approvalState: aquiferLinearRegressionModel.approvalState,
        approvalExpiresAt: aquiferLinearRegressionModel.approvalExpiresAt,
        rSquared: aquiferLinearRegressionModel.rSquared,
        dataCompletenessPct: aquiferLinearRegressionModel.dataCompletenessPct,
        outlierRatioPct: aquiferLinearRegressionModel.outlierRatioPct,
        trainingWindowEnd: aquiferLinearRegressionModel.trainingWindowEnd,
      })
      .from(aquiferLinearRegressionModel)
      .where(
        and(
          eq(aquiferLinearRegressionModel.scopeType, args.scopeType),
          eq(aquiferLinearRegressionModel.scopeId, args.scopeId),
          eq(aquiferLinearRegressionModel.targetType, args.targetType),
          eq(aquiferLinearRegressionModel.approvalState, "approved"),
          lte(aquiferLinearRegressionModel.createdAt, args.at),
          lte(aquiferLinearRegressionModel.trainingWindowEnd, args.at),
          or(
            isNull(aquiferLinearRegressionModel.approvalExpiresAt),
            gt(aquiferLinearRegressionModel.approvalExpiresAt, args.at),
          ),
        ),
      )
      .orderBy(desc(aquiferLinearRegressionModel.trainingWindowEnd))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      scopeType: row.scopeType,
      scopeId: row.scopeId,
      targetType: row.targetType,
      slope: Number(row.slope),
      intercept: Number(row.intercept),
      sampleCount: row.sampleCount,
      trainingWindowStart: row.trainingWindowStart,
      approvalState: row.approvalState,
      approvalExpiresAt: row.approvalExpiresAt,
      rSquared: row.rSquared == null ? null : Number(row.rSquared),
      dataCompletenessPct:
        row.dataCompletenessPct == null
          ? null
          : Number(row.dataCompletenessPct),
      outlierRatioPct:
        row.outlierRatioPct == null ? null : Number(row.outlierRatioPct),
      trainingWindowEnd: row.trainingWindowEnd,
    };
  }

  public async saveVersion(
    version: PersistedModelVersion,
    executor?: ForecastRepositoryDb,
  ): Promise<void> {
    const db = executor ?? this.db;

    await db.insert(aquiferLinearRegressionModel).values({
      id: version.id,
      scopeType: version.scopeType,
      scopeId: version.scopeId,
      targetType: version.targetType,
      slope: version.slope.toString(),
      intercept: version.intercept.toString(),
      rSquared: version.rSquared == null ? null : version.rSquared.toString(),
      sampleCount: version.sampleCount,
      trainingWindowStart: version.trainingWindowStart,
      trainingWindowEnd: version.trainingWindowEnd,
      dataCompletenessPct:
        version.dataCompletenessPct == null
          ? null
          : version.dataCompletenessPct.toString(),
      outlierRatioPct:
        version.outlierRatioPct == null
          ? null
          : version.outlierRatioPct.toString(),
      approvalState: version.approvalState,
      approvalExpiresAt: version.approvalExpiresAt,
    });
  }

  public async saveLineage(args: {
    modelVersionId: string;
    usageType: "train" | "validate" | "calibrate";
    observations: Array<{
      sourceSystem: string;
      stationId: string;
      districtId: string | null;
      wellId: string | null;
      observedAt: Date;
      metricType: string;
      value: number;
      unit: string;
      mappingConfidence: number | null;
      sourceSnapshotId: string;
    }>;
  }, executor?: ForecastRepositoryDb): Promise<void> {
    if (args.observations.length === 0) return;

    const persistLineage = async (db: ForecastRepositoryDb): Promise<void> => {
      const inserted = await db
        .insert(aquiferExternalReferenceObservation)
        .values(
          args.observations.map((observation) => ({
            sourceSystem: observation.sourceSystem,
            stationId: observation.stationId,
            districtId: observation.districtId,
            wellId: observation.wellId,
            observedAt: observation.observedAt,
            metricType: observation.metricType,
            value: observation.value.toString(),
            unit: observation.unit,
            mappingConfidence:
              observation.mappingConfidence == null
                ? null
                : observation.mappingConfidence.toString(),
            sourceSnapshotId: observation.sourceSnapshotId,
          })),
        )
        .returning({ id: aquiferExternalReferenceObservation.id });

      if (inserted.length === 0) return;

      await db.insert(aquiferModelReferenceObservationLink).values(
        inserted.map((row) => ({
          modelVersionId: args.modelVersionId,
          observationId: row.id,
          usageType: args.usageType,
        })),
      );
    };

    if (executor) {
      await persistLineage(executor);
      return;
    }

    await this.db.transaction(async (tx) => {
      await persistLineage(tx);
    });
  }
}

export class DrizzleRiskFlagRepository implements RiskFlagRepository {
  public constructor(private readonly db: Db) {}

  public async publish(
    flags: PersistedRiskFlag[],
    executor?: ForecastRepositoryDb,
  ): Promise<void> {
    if (flags.length === 0) return;
    const db = executor ?? this.db;

    await db.insert(aquiferRiskFlag).values(
      flags.map((flag) => ({
        scopeType: flag.scopeType,
        scopeId: flag.scopeId,
        targetType: flag.targetType,
        flagType: flag.flagType,
        riskLevel: flag.riskLevel,
        pointForecast:
          flag.pointForecast == null ? null : flag.pointForecast.toString(),
        interval80:
          flag.interval80 == null
            ? null
            : {
                lower: flag.interval80.lower,
                upper: flag.interval80.upper,
              },
        interval95:
          flag.interval95 == null
            ? null
            : {
                lower: flag.interval95.lower,
                upper: flag.interval95.upper,
              },
        reasonCodes: flag.reasonCodes,
        computedAt: flag.computedAt,
        modelVersionId: flag.modelVersionId,
        runId: flag.runId,
        plausibilityPolicyVersion: flag.plausibilityPolicyVersion,
      })),
    );
  }

  public async listByRun(runId: string): Promise<PersistedRiskFlag[]> {
    const rows = await this.db
      .select({
        scopeType: aquiferRiskFlag.scopeType,
        scopeId: aquiferRiskFlag.scopeId,
        targetType: aquiferRiskFlag.targetType,
        flagType: aquiferRiskFlag.flagType,
        riskLevel: aquiferRiskFlag.riskLevel,
        pointForecast: aquiferRiskFlag.pointForecast,
        interval80: aquiferRiskFlag.interval80,
        interval95: aquiferRiskFlag.interval95,
        reasonCodes: aquiferRiskFlag.reasonCodes,
        computedAt: aquiferRiskFlag.computedAt,
        modelVersionId: aquiferRiskFlag.modelVersionId,
        runId: aquiferRiskFlag.runId,
        plausibilityPolicyVersion: aquiferRiskFlag.plausibilityPolicyVersion,
      })
      .from(aquiferRiskFlag)
      .where(eq(aquiferRiskFlag.runId, runId));

    return rows.map((row) => ({
      scopeType: row.scopeType,
      scopeId: row.scopeId,
      targetType: row.targetType,
      flagType: row.flagType as PersistedRiskFlag["flagType"],
      riskLevel: row.riskLevel,
      pointForecast:
        row.pointForecast == null ? null : Number(row.pointForecast),
      interval80:
        row.interval80 &&
        typeof row.interval80 === "object" &&
        "lower" in row.interval80 &&
        "upper" in row.interval80
          ? {
              lower: Number((row.interval80 as { lower: unknown }).lower),
              upper: Number((row.interval80 as { upper: unknown }).upper),
            }
          : null,
      interval95:
        row.interval95 &&
        typeof row.interval95 === "object" &&
        "lower" in row.interval95 &&
        "upper" in row.interval95
          ? {
              lower: Number((row.interval95 as { lower: unknown }).lower),
              upper: Number((row.interval95 as { upper: unknown }).upper),
            }
          : null,
      reasonCodes: Array.isArray(row.reasonCodes)
        ? (row.reasonCodes as string[])
        : [],
      computedAt: row.computedAt,
      modelVersionId: row.modelVersionId,
      runId: row.runId,
      plausibilityPolicyVersion: row.plausibilityPolicyVersion,
    }));
  }
}
