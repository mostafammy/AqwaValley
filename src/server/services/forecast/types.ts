export type TimeWindow = {
  start: Date;
  end: Date;
};

export type ForecastScopeType = "district" | "well";
export type ForecastTargetType = "aquifer_level" | "extraction_vs_safe_yield";

export type DistrictSeries = {
  districtId: string;
  districtName: string;
  baselineDepthM: number | null;
  annualDepletionRateM: number | null;
  safeYieldM3Yr: number | null;
  warningThresholdPct: number | null;
  criticalThresholdPct: number | null;
};

export type WellReading = {
  wellId: string;
  sensorId: string;
  timestamp: Date;
  value: number;
};

export type WellSeries = {
  wellId: string;
  readings: WellReading[];
};

export type ExternalReferenceObservation = {
  sourceSystem: string;
  stationId: string;
  districtId: string | null;
  wellId: string | null;
  observedAt: Date;
  metricType: string;
  value: number;
  unit: string;
  mappingConfidence: number | null;
  sourceSnapshotId: string;
};

export type ForecastInputBundle = {
  districts: DistrictSeries[];
  wellSeries: WellSeries[];
  externalReferences: ExternalReferenceObservation[];
};

export type ForecastRunTrigger = "cron" | "manual" | "system";

export type ForecastRunDraft = {
  runKey: string;
  triggeredAt: Date;
  triggerType: ForecastRunTrigger;
  scopeType: ForecastScopeType;
  scopeIds: string[];
  targetTypes: ForecastTargetType[];
};
