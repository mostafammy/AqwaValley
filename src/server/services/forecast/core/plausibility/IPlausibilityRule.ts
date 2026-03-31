export type ForecastTrajectoryPoint = {
  yearOffset: number;
  predictedLevelM: number;
  impliedRechargeM3PerYear?: number | null;
  hasExogenousEvent?: boolean;
  // Projected stress expressed as a percent (0-100). Optional because not all
  // callers compute or need it; stored here to avoid recomputing when
  // downstream evaluators require percent-based inputs.
  projectedStressPct?: number | null;
  projectedStressPctUpper95?: number | null;
};

export type PlausibilityContext = {
  physicalFloorDepthM?: number | null;
  maxRecoveryMPerYear: number;
  maxDepletionMPerYear: number;
  maxImpliedRechargeM3PerYear: number;
  maxYoyDeltaM: number;
};

export type RuleResult = {
  ruleName: string;
  passed: boolean;
  reasonCode?: string;
  details?: string;
};

export interface IPlausibilityRule {
  readonly ruleName: string;
  evaluate(
    trajectory: ForecastTrajectoryPoint[],
    context: PlausibilityContext,
  ): RuleResult;
}
