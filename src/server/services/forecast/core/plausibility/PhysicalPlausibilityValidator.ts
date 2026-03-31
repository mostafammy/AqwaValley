import type {
  ForecastTrajectoryPoint,
  IPlausibilityRule,
  PlausibilityContext,
  RuleResult,
} from "~/server/services/forecast/core/plausibility/IPlausibilityRule";

export interface PlausibilityRuleRegistry {
  getRules(policyVersion: string): readonly IPlausibilityRule[];
}

export type PlausibilityEvaluation = {
  policyVersion: string;
  passed: boolean;
  results: RuleResult[];
};

export class PhysicalPlausibilityValidator {
  public constructor(private readonly registry: PlausibilityRuleRegistry) {}

  public validate(
    trajectory: ForecastTrajectoryPoint[],
    context: PlausibilityContext,
    policyVersion: string,
  ): PlausibilityEvaluation {
    const rules = this.registry.getRules(policyVersion);
    const results = rules.map((rule) => rule.evaluate(trajectory, context));

    return {
      policyVersion,
      passed: results.every((result) => result.passed),
      results,
    };
  }
}
