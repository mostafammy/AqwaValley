import type {
  FeaturePipeline,
  PreparedSeries,
} from "~/server/services/forecast/core/FeaturePipeline";
import type {
  IModelQualityReporter,
  IModelTrainer,
  ModelQualityMetrics,
  TrainedModel,
} from "~/server/services/forecast/core/LinearRegressionTrainer";
import type { IntervalEstimatorSelector } from "~/server/services/forecast/core/interval/IntervalEstimatorSelector";
import type { PhysicalPlausibilityValidator } from "~/server/services/forecast/core/plausibility/PhysicalPlausibilityValidator";
import type {
  ForecastTrajectoryPoint,
  PlausibilityContext,
} from "~/server/services/forecast/core/plausibility/IPlausibilityRule";
import type {
  HorizonRiskInput,
  IRiskEvaluator,
  RiskFlagSet,
} from "~/server/services/forecast/core/risk/IRiskEvaluator";
import type { ForecastPolicy } from "~/server/services/forecast/policy/forecastPolicy";
import type { WellReading } from "~/server/services/forecast/types";

export type ForecastExecutionContext = {
  scopeId: string;
  readings: WellReading[];
  warningThresholdPct: number;
  criticalThresholdPct: number;
  physicalFloorDepthM: number | null;
  selectorCoverageState: { coverageOutOfBandWindows: number };
  policy: ForecastPolicy;

  preparedSeries?: PreparedSeries;
  model?: TrainedModel;
  modelQuality?: ModelQualityMetrics;
  interval80?: ReturnType<IntervalEstimatorSelector["estimate"]>;
  interval95?: ReturnType<IntervalEstimatorSelector["estimate"]>;
  riskFlags?: RiskFlagSet;
  failed?: boolean;
  failureReason?: string;
};

function levelMToStressPct(
  levelM: number,
  context: ForecastExecutionContext,
): number {
  // Guard: ensure we never propagate NaN/Infinity — use a safe default.
  if (!Number.isFinite(levelM)) return 0;

  // If we don't have a physical floor reference, fall back to returning the
  // raw finite value so behavior is unchanged. When physicalFloorDepthM is
  // present it was set by the orchestrator as `baseline + 120`, so we
  // reverse that convention to estimate baseline and scale percent between
  // baseline (0%) and physical floor (100%). This is a conservative linear
  // mapping.
  const floor = context.physicalFloorDepthM;
  if (floor == null) return levelM;

  const baseline = floor - 120;
  const denom = floor - baseline;
  if (!Number.isFinite(denom) || denom === 0) return 0;

  const pct = ((levelM - baseline) / denom) * 100;
  if (!Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(100, pct));
}

export interface ForecastHandler {
  setNext(next: ForecastHandler): ForecastHandler;
  handle(context: ForecastExecutionContext): ForecastExecutionContext;
}

abstract class BaseForecastHandler implements ForecastHandler {
  private next: ForecastHandler | null = null;

  public setNext(next: ForecastHandler): ForecastHandler {
    this.next = next;
    return next;
  }

  public handle(context: ForecastExecutionContext): ForecastExecutionContext {
    const updated = this.process(context);
    if (updated.failed || !this.next) return updated;
    return this.next.handle(updated);
  }

  protected abstract process(
    context: ForecastExecutionContext,
  ): ForecastExecutionContext;
}

export class PrepareSeriesHandler extends BaseForecastHandler {
  public constructor(private readonly featurePipeline: FeaturePipeline) {
    super();
  }

  protected process(
    context: ForecastExecutionContext,
  ): ForecastExecutionContext {
    const prepared = this.featurePipeline.prepare(
      context.scopeId,
      context.readings,
    );

    if (prepared.points.length < 3) {
      return {
        ...context,
        preparedSeries: prepared,
        failed: true,
        failureReason: "insufficient_samples",
      };
    }

    return { ...context, preparedSeries: prepared };
  }
}

export class TrainModelHandler extends BaseForecastHandler {
  public constructor(
    private readonly trainer: IModelTrainer,
    private readonly qualityReporter: IModelQualityReporter,
  ) {
    super();
  }

  protected process(
    context: ForecastExecutionContext,
  ): ForecastExecutionContext {
    if (!context.preparedSeries) {
      return {
        ...context,
        failed: true,
        failureReason: "prepared_series_missing",
      };
    }

    const model = this.trainer.train(context.preparedSeries);
    const quality = this.qualityReporter.evaluateQuality(
      model,
      context.preparedSeries,
    );

    return {
      ...context,
      model,
      modelQuality: quality,
    };
  }
}

export class EstimateIntervalsHandler extends BaseForecastHandler {
  public constructor(private readonly selector: IntervalEstimatorSelector) {
    super();
  }

  protected process(
    context: ForecastExecutionContext,
  ): ForecastExecutionContext {
    if (!context.model) {
      return { ...context, failed: true, failureReason: "model_missing" };
    }

    const maxX = Math.max(...context.model.x, 0);
    const horizonX = [5, 10, 25].map((years) => maxX + years * 365);

    const interval80 = this.selector.estimate(
      {
        model: context.model,
        xValues: horizonX,
        level: 0.8,
      },
      context.selectorCoverageState,
    );

    const interval95 = this.selector.estimate(
      {
        model: context.model,
        xValues: horizonX,
        level: 0.95,
      },
      context.selectorCoverageState,
    );

    return {
      ...context,
      interval80,
      interval95,
    };
  }
}

export class PlausibilityGateHandler extends BaseForecastHandler {
  public constructor(
    private readonly validator: PhysicalPlausibilityValidator,
  ) {
    super();
  }

  protected process(
    context: ForecastExecutionContext,
  ): ForecastExecutionContext {
    if (!context.interval95) {
      return {
        ...context,
        failed: true,
        failureReason: "interval_estimation_missing",
      };
    }

    const trajectory: ForecastTrajectoryPoint[] = context.interval95.points.map(
      (p, idx) => {
        const predictedLevelM = p.yHat;
        const projectedStressPct = levelMToStressPct(predictedLevelM, context);
        const projectedStressPctUpper95 = levelMToStressPct(
          p.upper ?? predictedLevelM,
          context,
        );

        return {
          yearOffset: [5, 10, 25][idx] ?? 25,
          predictedLevelM,
          projectedStressPct,
          projectedStressPctUpper95,
        };
      },
    );

    const plausibilityContext: PlausibilityContext = {
      physicalFloorDepthM: context.physicalFloorDepthM,
      maxRecoveryMPerYear: context.policy.maxRecoveryMPerYear,
      maxDepletionMPerYear: context.policy.maxDepletionMPerYear,
      maxImpliedRechargeM3PerYear: context.policy.maxImpliedRechargeM3PerYear,
      maxYoyDeltaM: context.policy.maxYoyDeltaM,
    };

    const evaluation = this.validator.validate(
      trajectory,
      plausibilityContext,
      context.policy.plausibilityPolicyVersion,
    );

    if (!evaluation.passed) {
      return {
        ...context,
        failed: true,
        failureReason: `plausibility_failed:${evaluation.results
          .filter((r) => !r.passed)
          .map((r) => r.reasonCode ?? r.ruleName)
          .join(",")}`,
      };
    }

    return context;
  }
}

export class RiskMappingHandler extends BaseForecastHandler {
  public constructor(private readonly evaluator: IRiskEvaluator) {
    super();
  }

  protected process(
    context: ForecastExecutionContext,
  ): ForecastExecutionContext {
    if (!context.interval95) {
      return {
        ...context,
        failed: true,
        failureReason: "interval95_missing",
      };
    }

    const inputs: HorizonRiskInput[] = context.interval95.points.map(
      (p, idx) => ({
        horizonYears: ([5, 10, 25][idx] as 5 | 10 | 25) ?? 25,
        projectedStressPct: levelMToStressPct(p.yHat, context),
        projectedStressPctUpper95: levelMToStressPct(
          p.upper ?? p.yHat,
          context,
        ),
      }),
    );

    const riskFlags = this.evaluator.evaluate(inputs, {
      warningThresholdPct: context.warningThresholdPct,
      criticalThresholdPct: context.criticalThresholdPct,
    });

    return {
      ...context,
      riskFlags,
    };
  }
}
