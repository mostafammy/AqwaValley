import type { db as DbInstance } from "~/server/db";
import {
  CEDAREAdapter,
  type ExternalObservationProvider,
} from "~/server/services/forecast/adapters/CEDAREAdapter";
import { PostgresAdapter } from "~/server/services/forecast/adapters/PostgresAdapter";
import { TimescaleAdapter } from "~/server/services/forecast/adapters/TimescaleAdapter";
import {
  DataQualityFilter,
  FeaturePipeline,
  TimeAxisNormalizer,
} from "~/server/services/forecast/core/FeaturePipeline";
import { LinearRegressionTrainer } from "~/server/services/forecast/core/LinearRegressionTrainer";
import { BootstrapIntervalEstimator } from "~/server/services/forecast/core/interval/BootstrapIntervalEstimator";
import { ClosedFormIntervalEstimator } from "~/server/services/forecast/core/interval/ClosedFormIntervalEstimator";
import { IntervalEstimatorSelector } from "~/server/services/forecast/core/interval/IntervalEstimatorSelector";
import { PhysicalPlausibilityValidator } from "~/server/services/forecast/core/plausibility/PhysicalPlausibilityValidator";
import { StaticPlausibilityRuleRegistry } from "~/server/services/forecast/core/plausibility/rules/V0PlausibilityRules";
import { SQ13RiskEvaluator } from "~/server/services/forecast/core/risk/SQ13RiskEvaluator";
import {
  EstimateIntervalsHandler,
  PlausibilityGateHandler,
  PrepareSeriesHandler,
  RiskMappingHandler,
  TrainModelHandler,
} from "~/server/services/forecast/core/pipeline/handlers";
import { ForecastRunFactory } from "~/server/services/forecast/ForecastRunFactory";
import { ForecastRunOrchestrator } from "~/server/services/forecast/ForecastRunOrchestrator";
import { HistoricalDataLoader } from "~/server/services/forecast/HistoricalDataLoader";
import {
  DEFAULT_FORECAST_POLICY,
  type ForecastPolicy,
} from "~/server/services/forecast/policy/forecastPolicy";
import {
  DrizzleForecastArtifactRepository,
  DrizzleModelVersionRepository,
  DrizzleRiskFlagRepository,
} from "~/server/services/forecast/repositories/drizzleRepositories";

type Db = typeof DbInstance;

export type ForecastRuntimeOptions = {
  externalObservationProvider?: ExternalObservationProvider;
};

export function createForecastRuntime(
  db: Db,
  policy: ForecastPolicy = DEFAULT_FORECAST_POLICY,
  options?: ForecastRuntimeOptions,
): ForecastRunOrchestrator {
  const baseAdapter = new PostgresAdapter(db);
  const internalAdapter = new TimescaleAdapter(baseAdapter);
  const externalAdapter = new CEDAREAdapter(
    options?.externalObservationProvider,
  );
  const loader = new HistoricalDataLoader(internalAdapter, [externalAdapter]);

  const featurePipeline = new FeaturePipeline(
    new TimeAxisNormalizer(),
    new DataQualityFilter({ zScoreOutlierThreshold: 3 }),
  );

  const trainer = new LinearRegressionTrainer();
  const selector = new IntervalEstimatorSelector(
    new ClosedFormIntervalEstimator(),
    new BootstrapIntervalEstimator(policy),
  );

  const plausibilityValidator = new PhysicalPlausibilityValidator(
    new StaticPlausibilityRuleRegistry(),
  );

  const riskEvaluator = new SQ13RiskEvaluator();

  const prepare = new PrepareSeriesHandler(featurePipeline);
  const train = new TrainModelHandler(trainer, trainer);
  const interval = new EstimateIntervalsHandler(selector);
  const plausibility = new PlausibilityGateHandler(plausibilityValidator);
  const risk = new RiskMappingHandler(riskEvaluator);

  prepare.setNext(train).setNext(interval).setNext(plausibility).setNext(risk);

  return new ForecastRunOrchestrator(
    db,
    loader,
    new ForecastRunFactory(),
    new DrizzleForecastArtifactRepository(db),
    new DrizzleModelVersionRepository(db),
    new DrizzleRiskFlagRepository(db),
    prepare,
    policy,
  );
}
