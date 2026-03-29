import type {
  ForecastScopeType,
  ForecastTargetType,
} from "~/server/services/forecast/types";

export type ForecastRiskLevel = "low" | "moderate" | "high" | "critical";

export type PersistedRiskFlag = {
  scopeType: ForecastScopeType;
  scopeId: string;
  targetType: ForecastTargetType;
  flagType: "SQ13_5YR" | "SQ13_10YR" | "SQ13_25YR" | "SQ13_COMPOSITE";
  riskLevel: ForecastRiskLevel;
  pointForecast: number | null;
  interval80: { lower: number; upper: number } | null;
  interval95: { lower: number; upper: number } | null;
  reasonCodes: string[];
  computedAt: Date;
  modelVersionId: string;
  runId: string;
  plausibilityPolicyVersion: string;
};

export interface RiskFlagRepository {
  publish(flags: PersistedRiskFlag[]): Promise<void>;
  listByRun(runId: string): Promise<PersistedRiskFlag[]>;
}
