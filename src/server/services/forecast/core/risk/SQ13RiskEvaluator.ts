import type {
  HorizonRiskFlag,
  HorizonRiskInput,
  IRiskEvaluator,
  RiskFlagSet,
  RiskLevel,
  RiskThresholds,
} from "~/server/services/forecast/core/risk/IRiskEvaluator";

const RISK_ORDER: Record<RiskLevel, number> = {
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

function toFlagType(horizon: 5 | 10 | 25): HorizonRiskFlag["flagType"] {
  if (horizon === 5) return "SQ13_5YR";
  if (horizon === 10) return "SQ13_10YR";
  return "SQ13_25YR";
}

function evaluateRiskLevel(
  value: number,
  upper95: number,
  thresholds: RiskThresholds,
): { level: RiskLevel; reasons: string[] } {
  const reasons: string[] = [];

  if (value >= thresholds.criticalThresholdPct) {
    reasons.push("critical_threshold_crossed");
    return { level: "critical", reasons };
  }

  if (value >= thresholds.warningThresholdPct) {
    reasons.push("warning_threshold_crossed");
    if (upper95 >= thresholds.criticalThresholdPct) {
      reasons.push("upper95_crosses_critical");
      return { level: "high", reasons };
    }
    return { level: "moderate", reasons };
  }

  if (upper95 >= thresholds.warningThresholdPct) {
    reasons.push("upper95_crosses_warning");
    return { level: "moderate", reasons };
  }

  reasons.push("below_warning_threshold");
  return { level: "low", reasons };
}

export class SQ13RiskEvaluator implements IRiskEvaluator {
  public evaluate(
    inputs: HorizonRiskInput[],
    thresholds: RiskThresholds,
  ): RiskFlagSet {
    const horizons = inputs.map((input) => {
      const result = evaluateRiskLevel(
        input.projectedStressPct,
        input.projectedStressPctUpper95,
        thresholds,
      );

      return {
        horizonYears: input.horizonYears,
        flagType: toFlagType(input.horizonYears),
        riskLevel: result.level,
        reasonCodes: result.reasons,
      } satisfies HorizonRiskFlag;
    });

    const composite = horizons.reduce((max, current) => {
      return RISK_ORDER[current.riskLevel] > RISK_ORDER[max.riskLevel]
        ? current
        : max;
    }, horizons[0]!);

    return {
      horizons,
      composite: {
        flagType: "SQ13_COMPOSITE",
        riskLevel: composite.riskLevel,
        reasonCodes: [
          "highest_horizon_severity",
          `derived_from_${composite.flagType.toLowerCase()}`,
        ],
      },
    };
  }
}
