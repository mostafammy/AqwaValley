import type {
  ForecastTrajectoryPoint,
  IPlausibilityRule,
  PlausibilityContext,
  RuleResult,
} from "~/server/services/forecast/core/plausibility/IPlausibilityRule";
import type { PlausibilityRuleRegistry } from "~/server/services/forecast/core/plausibility/PhysicalPlausibilityValidator";

function fail(
  ruleName: string,
  reasonCode: string,
  details: string,
): RuleResult {
  return { ruleName, passed: false, reasonCode, details };
}

function pass(ruleName: string): RuleResult {
  return { ruleName, passed: true };
}

class MaxRecoveryRateRule implements IPlausibilityRule {
  public readonly ruleName = "max_recovery_rate";

  public evaluate(
    trajectory: ForecastTrajectoryPoint[],
    context: PlausibilityContext,
  ): RuleResult {
    for (let i = 1; i < trajectory.length; i++) {
      const prev = trajectory[i - 1]!;
      const curr = trajectory[i]!;
      const delta = prev.predictedLevelM - curr.predictedLevelM;
      if (delta > context.maxRecoveryMPerYear) {
        return fail(
          this.ruleName,
          "recovery_rate_exceeded",
          `delta=${delta.toFixed(4)} > max=${context.maxRecoveryMPerYear.toFixed(4)}`,
        );
      }
    }
    return pass(this.ruleName);
  }
}

class MaxDepletionRateRule implements IPlausibilityRule {
  public readonly ruleName = "max_depletion_rate";

  public evaluate(
    trajectory: ForecastTrajectoryPoint[],
    context: PlausibilityContext,
  ): RuleResult {
    for (let i = 1; i < trajectory.length; i++) {
      const prev = trajectory[i - 1]!;
      const curr = trajectory[i]!;
      const delta = curr.predictedLevelM - prev.predictedLevelM;
      if (delta > context.maxDepletionMPerYear) {
        return fail(
          this.ruleName,
          "depletion_rate_exceeded",
          `delta=${delta.toFixed(4)} > max=${context.maxDepletionMPerYear.toFixed(4)}`,
        );
      }
    }
    return pass(this.ruleName);
  }
}

class PhysicalFloorRule implements IPlausibilityRule {
  public readonly ruleName = "physical_floor";

  public evaluate(
    trajectory: ForecastTrajectoryPoint[],
    context: PlausibilityContext,
  ): RuleResult {
    if (context.physicalFloorDepthM == null) {
      return pass(this.ruleName);
    }

    const floor = context.physicalFloorDepthM;
    for (const point of trajectory) {
      if (point.predictedLevelM > floor) {
        return fail(
          this.ruleName,
          "physical_floor_crossed",
          `predicted=${point.predictedLevelM.toFixed(4)} > floor=${floor.toFixed(4)}`,
        );
      }
    }

    return pass(this.ruleName);
  }
}

class RechargeConsistencyRule implements IPlausibilityRule {
  public readonly ruleName = "recharge_consistency";

  public evaluate(
    trajectory: ForecastTrajectoryPoint[],
    context: PlausibilityContext,
  ): RuleResult {
    for (const point of trajectory) {
      const recharge = point.impliedRechargeM3PerYear;
      if (recharge != null && recharge > context.maxImpliedRechargeM3PerYear) {
        return fail(
          this.ruleName,
          "implied_recharge_exceeded",
          `recharge=${recharge.toFixed(2)} > max=${context.maxImpliedRechargeM3PerYear.toFixed(2)}`,
        );
      }
    }

    return pass(this.ruleName);
  }
}

class BoundaryContinuityRule implements IPlausibilityRule {
  public readonly ruleName = "boundary_continuity";

  public evaluate(
    trajectory: ForecastTrajectoryPoint[],
    context: PlausibilityContext,
  ): RuleResult {
    for (let i = 1; i < trajectory.length; i++) {
      const prev = trajectory[i - 1]!;
      const curr = trajectory[i]!;
      const delta = Math.abs(curr.predictedLevelM - prev.predictedLevelM);

      if (delta > context.maxYoyDeltaM && !curr.hasExogenousEvent) {
        return fail(
          this.ruleName,
          "yoy_discontinuity_exceeded",
          `|delta|=${delta.toFixed(4)} > max=${context.maxYoyDeltaM.toFixed(4)}`,
        );
      }
    }

    return pass(this.ruleName);
  }
}

const V0_RULES: readonly IPlausibilityRule[] = [
  new MaxRecoveryRateRule(),
  new MaxDepletionRateRule(),
  new PhysicalFloorRule(),
  new RechargeConsistencyRule(),
  new BoundaryContinuityRule(),
];

export class StaticPlausibilityRuleRegistry implements PlausibilityRuleRegistry {
  public getRules(policyVersion: string): readonly IPlausibilityRule[] {
    if (policyVersion === "v0") {
      return V0_RULES;
    }
    return [];
  }
}
