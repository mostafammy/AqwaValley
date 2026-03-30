export type ForecastTrajectoryPoint = {
  yearOffset: number;
  predictedLevelM: number;
  impliedRechargeM3PerYear?: number | null;
  hasExogenousEvent?: boolean;
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
