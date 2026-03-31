import type { ForecastRepositoryDb } from "~/server/services/forecast/repositories/ForecastArtifactRepository";
import type {
  ExternalReferenceObservation,
  ForecastScopeType,
  ForecastTargetType,
} from "~/server/services/forecast/types";

export type ModelApprovalState =
  | "pending_review"
  | "approved"
  | "rejected"
  | "expired"
  | "superseded";

export type PersistedModelVersion = {
  id: string;
  scopeType: ForecastScopeType;
  scopeId: string;
  targetType: ForecastTargetType;
  slope: number;
  intercept: number;
  sampleCount: number;
  trainingWindowStart: Date;
  approvalState: ModelApprovalState;
  approvalExpiresAt: Date | null;
  rSquared: number | null;
  dataCompletenessPct: number | null;
  outlierRatioPct: number | null;
  trainingWindowEnd: Date;
};

export type PersistedLineageObservation = {
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

export interface ModelVersionRepository {
  findEligibleModel(args: {
    scopeType: ForecastScopeType;
    scopeId: string;
    targetType: ForecastTargetType;
    at: Date;
  }): Promise<PersistedModelVersion | null>;

  saveVersion(
    version: PersistedModelVersion,
    executor?: ForecastRepositoryDb,
  ): Promise<void>;

  saveLineage(
    args: {
      modelVersionId: string;
      usageType: "train" | "validate" | "calibrate";
      observations: ExternalReferenceObservation[];
    },
    executor?: ForecastRepositoryDb,
  ): Promise<void>;
}
