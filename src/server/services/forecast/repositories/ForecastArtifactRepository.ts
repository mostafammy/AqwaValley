import type { ForecastRunDraft } from "~/server/services/forecast/types";

export type PersistedForecastRun = {
  runKey: string;
  triggerType: ForecastRunDraft["triggerType"];
  scopeType: ForecastRunDraft["scopeType"];
  scopeIds: string[];
  startedAt: Date;
  status: "queued" | "running" | "completed" | "failed";
  completedAt: Date | null;
  durationMs: number | null;
  errorSummary: string | null;
};

export interface ForecastArtifactRepository {
  createRun(draft: ForecastRunDraft): Promise<PersistedForecastRun>;
  markRunCompleted(args: { runKey: string; durationMs: number }): Promise<void>;
  markRunFailed(args: { runKey: string; errorSummary: string }): Promise<void>;
  findRun(runKey: string): Promise<PersistedForecastRun | null>;
}
