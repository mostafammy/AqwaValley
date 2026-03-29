import type {
  CubicMeters,
  CubicMetersPerSecond,
  Meters,
  Pascals,
  Seconds,
  SquareMeters,
  UnitInterval,
} from "./units";
import type { Result } from "./result";

export interface ICropCoefficientProvider {
  getCropCoefficient(input: {
    cropType: string;
    growthStage: string;
    at: Date;
  }): Promise<Result<{ kc: number; providerVersion: string }>>;
}

export interface ISoilHydraulicsProvider {
  getHydraulics(input: {
    soilType: string;
    at: Date;
  }): Promise<
    Result<{
      drainageCoefficientPerSecond: number;
      fieldCapacityDepthM: number;
      providerVersion: string;
    }>
  >;
}

export type WeatherFreshness = "FRESH" | "STALE" | "UNAVAILABLE";

export interface IWeatherProvider {
  getEt0DepthRateMps(input: {
    districtId: string;
    at: Date;
  }): Promise<
    Result<{
      et0DepthRateMps: number;
      freshness: WeatherFreshness;
      ageMinutes: number;
      source: "live_api" | "cache" | "climatology";
      providerVersion: string;
    }>
  >;
}

export type ETcInput = {
  et0DepthRateMps: number;
  kc: number;
  stressCoefficient: UnitInterval;
  irrigatedAreaM2: SquareMeters;
};

export type DrainageInput = {
  drainageCoefficientPerSecond: number;
  fieldCapacityDepthM: Meters;
  waterLevelM: Meters;
  irrigatedAreaM2: SquareMeters;
  maxDrainableVolumeM3: CubicMeters;
  dtS: Seconds;
};

export type InflowMode = "pressure_aware" | "constant_flow";

export type InflowInput = {
  mode: InflowMode;
  valveOpen: boolean;
  baseFlowRateM3s: CubicMetersPerSecond;
  pressurePa: Pascals;
  nominalPressurePa: Pascals;
  maxPressureMultiplier: number;
  constantFlowM3s?: CubicMetersPerSecond;
};

export interface IHydrologyModel {
  readonly version: string;

  computeETc(input: ETcInput): Result<CubicMetersPerSecond>;
  computeDrainage(input: DrainageInput): Result<CubicMetersPerSecond>;
  computeInflow(input: InflowInput): Result<CubicMetersPerSecond>;
}

export type PhysicsState = {
  waterLevelM: Meters;
  waterDebtM3: CubicMeters;
};

export type DerivativeTerms = {
  inflowM3s: CubicMetersPerSecond;
  etCubicMetersPerSecond: CubicMetersPerSecond;
  drainageM3s: CubicMetersPerSecond;
};

export type HydrologyStepInput = {
  et: ETcInput;
  drainage: DrainageInput;
  inflow: InflowInput;
};

export type PhysicsSample = {
  timestamp: Date;
  elapsedSeconds: Seconds;
  waterLevelM: Meters;
  waterDebtM3: CubicMeters;
  dtUsedS: Seconds;
  errorNorm: number;
};

export type PhysicsRunStatus = "completed" | "cancelled";

export type PhysicsRunInput = {
  startTimestamp: Date;
  horizonSeconds: Seconds;
  initialState: PhysicsState;
  irrigatedAreaM2: SquareMeters;
  initialDtS: Seconds;
  minDtS: Seconds;
  maxDtS: Seconds;
  absTolM: number;
  relTol: number;
  maxRefinementsPerStep: number;
  maxDryDurationSeconds: Seconds;
  shouldCancel?: () => boolean;
  getDerivativeTerms: (params: {
    timestamp: Date;
    elapsedSeconds: Seconds;
    state: PhysicsState;
    dtS: Seconds;
  }) => Result<DerivativeTerms>;
};

export type PhysicsRunOutput = {
  status: PhysicsRunStatus;
  terminalState: PhysicsState;
  samples: PhysicsSample[];
  integrationStepCount: number;
  retryCount: number;
  dtMinObservedS: Seconds;
  dtMaxObservedS: Seconds;
  errorNormMax: number;
  errorNormP95: number;
  numericalDivergenceCount: number;
  massDebtPeakM3: CubicMeters;
  debtEventCount: number;
};

export interface IIrrigationPhysicsEngine {
  readonly engineVersion: string;
  readonly hydrologyModelVersion: string;
  run(input: PhysicsRunInput): Result<PhysicsRunOutput>;
}

export interface IRunReplayService {
  replayRun(runId: string): Promise<Result<{ outputHash: string }>>;
}

export type RunDiffStatus = "PASS" | "WARN" | "FAIL";

export type RunDiffResult = {
  status: RunDiffStatus;
  waterLevelRmse: number;
  flowRmse: number;
  totalExtractedDeltaPercent: number;
  invalidQualityStateIncrease: number;
  violatedThresholds: string[];
};

export interface IRunDiffService {
  diffRuns(baseRunId: string, candidateRunId: string): Promise<Result<RunDiffResult>>;
}
