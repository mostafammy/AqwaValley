import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";

import type { db as DbInstance } from "~/server/db";
import { aquiferForecastRun, district, well } from "~/server/db/schema";
import type { HistoricalDataLoader } from "~/server/services/forecast/HistoricalDataLoader";
import type { ForecastRunFactory } from "~/server/services/forecast/ForecastRunFactory";
import type { ForecastArtifactRepository } from "~/server/services/forecast/repositories/ForecastArtifactRepository";
import type { ModelVersionRepository } from "~/server/services/forecast/repositories/ModelVersionRepository";
import type { RiskFlagRepository } from "~/server/services/forecast/repositories/RiskFlagRepository";
import type { ForecastPolicy } from "~/server/services/forecast/policy/forecastPolicy";
import type {
  ForecastExecutionContext,
  ForecastHandler,
} from "~/server/services/forecast/core/pipeline/handlers";
import type { ForecastRunTrigger } from "~/server/services/forecast/types";

type Db = typeof DbInstance;

export type RunDistrictForecastInput = {
  districtId: string;
  runKey?: string;
  triggerType: ForecastRunTrigger;
  selectorCoverageOutOfBandWindows?: number;
  windowMonths?: number;
};

export type RunDistrictForecastResult = {
  runKey: string;
  status: "completed" | "failed";
  replay: boolean;
  failureReason?: string;
  modelId?: string;
  risk?: {
    horizons: Array<{
      flagType: string;
      riskLevel: string;
      reasonCodes: string[];
    }>;
    composite: { flagType: string; riskLevel: string; reasonCodes: string[] };
  };
};

export class ForecastRunOrchestrator {
  public constructor(
    private readonly db: Db,
    private readonly loader: HistoricalDataLoader,
    private readonly runFactory: ForecastRunFactory,
    private readonly runRepository: ForecastArtifactRepository,
    private readonly modelRepository: ModelVersionRepository,
    private readonly riskRepository: RiskFlagRepository,
    private readonly pipelineRoot: ForecastHandler,
    private readonly policy: ForecastPolicy,
  ) {}

  public async runDistrictForecast(
    input: RunDistrictForecastInput,
  ): Promise<RunDistrictForecastResult> {
    const now = new Date();
    const runDraft = this.runFactory.createRunDraft({
      triggerType: input.triggerType,
      scopeType: "district",
      scopeIds: [input.districtId],
      targetTypes: ["aquifer_level", "extraction_vs_safe_yield"],
      now,
    });

    const runKey = input.runKey ?? runDraft.runKey;
    const existing = await this.runRepository.findRun(runKey);
    if (existing?.status === "completed") {
      return {
        runKey,
        status: "completed",
        replay: true,
      };
    }

    const startedAt = Date.now();
    await this.runRepository.createRun({ ...runDraft, runKey });

    try {
      const districtRow = await this.db
        .select({
          warningThresholdPct: district.warningThresholdPct,
          criticalThresholdPct: district.criticalThresholdPct,
          baselineDepthM: district.baselineDepthM,
        })
        .from(district)
        .where(eq(district.id, input.districtId))
        .limit(1);

      const d = districtRow[0];
      if (!d) {
        throw new Error("District not found");
      }

      const wellRows = await this.db
        .select({ id: well.id })
        .from(well)
        .where(eq(well.districtId, input.districtId));

      const wellIds = wellRows.map((w) => w.id);
      if (wellIds.length === 0) {
        throw new Error("No wells found for district");
      }

      const windowEnd = now;
      const windowStart = new Date(windowEnd);
      windowStart.setUTCMonth(
        windowStart.getUTCMonth() - (input.windowMonths ?? 24),
      );

      const bundle = await this.loader.loadDistrictBundle({
        districtIds: [input.districtId],
        wellIds,
        window: {
          start: windowStart,
          end: windowEnd,
        },
      });

      const mergedReadings = bundle.wellSeries.flatMap((s) => s.readings);

      const executionContext: ForecastExecutionContext = {
        scopeId: input.districtId,
        readings: mergedReadings,
        warningThresholdPct: Number(d.warningThresholdPct ?? 70),
        criticalThresholdPct: Number(d.criticalThresholdPct ?? 85),
        physicalFloorDepthM:
          d.baselineDepthM != null ? Number(d.baselineDepthM) + 120 : null,
        selectorCoverageState: {
          coverageOutOfBandWindows: input.selectorCoverageOutOfBandWindows ?? 0,
        },
        policy: this.policy,
      };

      const executed = this.pipelineRoot.handle(executionContext);

      if (executed.failed || !executed.riskFlags) {
        await this.runRepository.markRunFailed({
          runKey,
          errorSummary: executed.failureReason ?? "unknown_pipeline_failure",
        });
        return {
          runKey,
          status: "failed",
          replay: false,
          failureReason: executed.failureReason,
        };
      }

      if (!executed.model) {
        await this.runRepository.markRunFailed({
          runKey,
          errorSummary: "model_missing_after_pipeline",
        });
        return {
          runKey,
          status: "failed",
          replay: false,
          failureReason: "model_missing_after_pipeline",
        };
      }

      const modelId = randomUUID();
      const trainingWindowStart =
        executed.preparedSeries?.points[0]?.timestamp ?? windowStart;

      await this.modelRepository.saveVersion({
        id: modelId,
        scopeType: "district",
        scopeId: input.districtId,
        targetType: "aquifer_level",
        slope: executed.model.coefficients.slope,
        intercept: executed.model.coefficients.intercept,
        sampleCount: executed.model.sampleCount,
        trainingWindowStart,
        approvalState: "pending_review",
        approvalExpiresAt: null,
        rSquared: executed.modelQuality?.rSquared ?? null,
        dataCompletenessPct: executed.modelQuality?.dataCompletenessPct ?? null,
        outlierRatioPct: executed.modelQuality?.outlierRatioPct ?? null,
        trainingWindowEnd: now,
      });

      await this.modelRepository.saveLineage({
        modelVersionId: modelId,
        usageType: "validate",
        observations: bundle.externalReferences,
      });

      const runRow = await this.db
        .select({ id: aquiferForecastRun.id })
        .from(aquiferForecastRun)
        .where(eq(aquiferForecastRun.runKey, runKey))
        .limit(1);

      const runId = runRow[0]?.id;
      if (!runId) {
        throw new Error("Run row not found after creation");
      }

      await this.riskRepository.publish([
        ...executed.riskFlags.horizons.map((flag, idx) => {
          const interval80Point = executed.interval80?.points[idx];
          const interval95Point = executed.interval95?.points[idx];

          return {
            scopeType: "district" as const,
            scopeId: input.districtId,
            targetType: "aquifer_level" as const,
            flagType: flag.flagType,
            riskLevel: flag.riskLevel,
            pointForecast: interval95Point?.yHat ?? null,
            interval80: interval80Point
              ? {
                  lower: interval80Point.lower,
                  upper: interval80Point.upper,
                }
              : null,
            interval95: interval95Point
              ? {
                  lower: interval95Point.lower,
                  upper: interval95Point.upper,
                }
              : null,
            reasonCodes: flag.reasonCodes,
            computedAt: now,
            modelVersionId: modelId,
            runId,
            plausibilityPolicyVersion: this.policy.plausibilityPolicyVersion,
          };
        }),
        {
          scopeType: "district" as const,
          scopeId: input.districtId,
          targetType: "aquifer_level" as const,
          flagType: executed.riskFlags.composite.flagType,
          riskLevel: executed.riskFlags.composite.riskLevel,
          pointForecast: null,
          interval80: null,
          interval95: null,
          reasonCodes: executed.riskFlags.composite.reasonCodes,
          computedAt: now,
          modelVersionId: modelId,
          runId,
          plausibilityPolicyVersion: this.policy.plausibilityPolicyVersion,
        },
      ]);

      await this.runRepository.markRunCompleted({
        runKey,
        durationMs: Date.now() - startedAt,
      });

      return {
        runKey,
        status: "completed",
        replay: false,
        modelId,
        risk: {
          horizons: executed.riskFlags.horizons,
          composite: executed.riskFlags.composite,
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "forecast_run_failed";
      await this.runRepository.markRunFailed({
        runKey,
        errorSummary: message,
      });

      return {
        runKey,
        status: "failed",
        replay: false,
        failureReason: message,
      };
    }
  }
}
