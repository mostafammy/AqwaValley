export type HorizonRiskInput = {
  horizonYears: 5 | 10 | 25;
  projectedStressPct: number;
  projectedStressPctUpper95: number;
};

export type RiskThresholds = {
  warningThresholdPct: number;
  criticalThresholdPct: number;
};

export type RiskLevel = "low" | "moderate" | "high" | "critical";

export type HorizonRiskFlag = {
  horizonYears: 5 | 10 | 25;
  flagType: "SQ13_5YR" | "SQ13_10YR" | "SQ13_25YR";
  riskLevel: RiskLevel;
  reasonCodes: string[];
};

export type RiskFlagSet = {
  horizons: HorizonRiskFlag[];
  composite: {
    flagType: "SQ13_COMPOSITE";
    riskLevel: RiskLevel;
    reasonCodes: string[];
  };
};

export interface IRiskEvaluator {
  evaluate(inputs: HorizonRiskInput[], thresholds: RiskThresholds): RiskFlagSet;
}
