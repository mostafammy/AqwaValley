import { describe, expect, it } from "vitest";

import { PhysicalPlausibilityValidator } from "~/server/services/forecast/core/plausibility/PhysicalPlausibilityValidator";
import { StaticPlausibilityRuleRegistry } from "~/server/services/forecast/core/plausibility/rules/V0PlausibilityRules";
import { DEFAULT_FORECAST_POLICY } from "~/server/services/forecast/policy/forecastPolicy";

describe("Forecast plausibility contract coverage (Invariant #8)", () => {
  it("forecast_respects_plausibility_rule_versioning", () => {
    const registry = new StaticPlausibilityRuleRegistry();

    expect(registry.getRules("v0").length).toBeGreaterThan(0);
    expect(registry.getRules("unknown-policy")).toEqual([]);
  });

  it("forecast_rejects_physically_impossible_trajectory", () => {
    const validator = new PhysicalPlausibilityValidator(
      new StaticPlausibilityRuleRegistry(),
    );

    const impossibleTrajectory = [
      { yearOffset: 0, predictedLevelM: 10, impliedRechargeM3PerYear: 0 },
      { yearOffset: 1, predictedLevelM: 13, impliedRechargeM3PerYear: 0 },
    ];

    const result = validator.validate(
      impossibleTrajectory,
      {
        maxRecoveryMPerYear: DEFAULT_FORECAST_POLICY.maxRecoveryMPerYear,
        maxDepletionMPerYear: DEFAULT_FORECAST_POLICY.maxDepletionMPerYear,
        maxImpliedRechargeM3PerYear:
          DEFAULT_FORECAST_POLICY.maxImpliedRechargeM3PerYear,
        maxYoyDeltaM: DEFAULT_FORECAST_POLICY.maxYoyDeltaM,
        physicalFloorDepthM: 100,
      },
      DEFAULT_FORECAST_POLICY.plausibilityPolicyVersion,
    );

    expect(result.passed).toBe(false);
    expect(result.results.some((r) => r.passed === false)).toBe(true);
  });

  it("forecast_regresses_against_known_depletion_anchor", () => {
    const validator = new PhysicalPlausibilityValidator(
      new StaticPlausibilityRuleRegistry(),
    );

    const anchoredTrajectory = [
      { yearOffset: 0, predictedLevelM: 60, impliedRechargeM3PerYear: -1000 },
      { yearOffset: 1, predictedLevelM: 61.2, impliedRechargeM3PerYear: -1200 },
      { yearOffset: 2, predictedLevelM: 62.1, impliedRechargeM3PerYear: -900 },
    ];

    const result = validator.validate(
      anchoredTrajectory,
      {
        maxRecoveryMPerYear: DEFAULT_FORECAST_POLICY.maxRecoveryMPerYear,
        maxDepletionMPerYear: DEFAULT_FORECAST_POLICY.maxDepletionMPerYear,
        maxImpliedRechargeM3PerYear:
          DEFAULT_FORECAST_POLICY.maxImpliedRechargeM3PerYear,
        maxYoyDeltaM: DEFAULT_FORECAST_POLICY.maxYoyDeltaM,
        physicalFloorDepthM: 100,
      },
      DEFAULT_FORECAST_POLICY.plausibilityPolicyVersion,
    );

    expect(result.policyVersion).toBe("v0");
    expect(result.passed).toBe(true);
  });
});
