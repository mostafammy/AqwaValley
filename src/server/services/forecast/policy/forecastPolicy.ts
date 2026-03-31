export type ForecastPolicy = {
  plausibilityPolicyVersion: string;
  maxRecoveryMPerYear: number;
  maxDepletionMPerYear: number;
  maxImpliedRechargeM3PerYear: number;
  maxYoyDeltaM: number;
  maxBootstrapIterations: number;
  maxBootstrapSampleSize: number;
  maxModelStalenessDays: number;
  districtTimeoutMs: number;
  maxDistrictConcurrency: number;
};

export const DEFAULT_FORECAST_POLICY: ForecastPolicy = {
  plausibilityPolicyVersion: "v0",
  maxRecoveryMPerYear: 0.2,
  maxDepletionMPerYear: 1.5,
  maxImpliedRechargeM3PerYear: 0,
  maxYoyDeltaM: 2.0,
  maxBootstrapIterations: 2000,
  maxBootstrapSampleSize: 20000,
  maxModelStalenessDays: 7,
  districtTimeoutMs: 90_000,
  maxDistrictConcurrency: 3,
};
