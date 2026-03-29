import { and, eq, inArray } from "drizzle-orm";

import { db } from "~/server/db";
import { irrigationSimulationRun, sensorDataSimulation, sensors } from "~/server/db/schema";
import { createDomainError, err, ok, type Result, type RunDiffResult } from "./simulation";

const THRESHOLDS = {
  passWaterLevelRmse: 0.02,
  warnWaterLevelRmse: 0.05,
  passExtractedDeltaPct: 0.5,
  warnExtractedDeltaPct: 1.0,
} as const;

type RunSeries = {
  waterLevelPoints: Array<{ ts: number; value: number }>;
  flowRatePoints: Array<{ ts: number; value: number }>;
};

function rmse(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  if (length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < length; i += 1) {
    const d = a[i]! - b[i]!;
    sum += d * d;
  }
  return Math.sqrt(sum / length);
}

function parseInvalidCount(input: unknown): number {
  if (!input || typeof input !== "object") return 0;
  const record = input as Record<string, unknown>;
  const value = record.INVALID;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function integrateFlowVolumeM3(points: Array<{ ts: number; value: number }>): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const dtSeconds = (curr.ts - prev.ts) / 1000;
    if (dtSeconds <= 0) continue;
    const avgFlow = (prev.value + curr.value) / 2;
    total += avgFlow * dtSeconds;
  }
  return total;
}

async function loadSeries(runId: string): Promise<RunSeries> {
  const rows = await db
    .select({
      value: sensorDataSimulation.value,
      timestamp: sensorDataSimulation.timestamp,
      sensorType: sensors.type,
    })
    .from(sensorDataSimulation)
    .innerJoin(sensors, eq(sensorDataSimulation.sensorId, sensors.id))
    .where(
      and(
        eq(sensorDataSimulation.simulationRunId, runId),
        inArray(sensors.type, ["water_level", "flow_rate"]),
      ),
    );

  const waterLevelByTs = new Map<number, number[]>();
  const flowByTs = new Map<number, number[]>();

  for (const row of rows) {
    const key = row.timestamp.getTime();
    if (row.sensorType === "water_level") {
      const list = waterLevelByTs.get(key) ?? [];
      list.push(row.value);
      waterLevelByTs.set(key, list);
    }
    if (row.sensorType === "flow_rate") {
      const list = flowByTs.get(key) ?? [];
      list.push(row.value);
      flowByTs.set(key, list);
    }
  }

  const toAveragedSeries = (source: Map<number, number[]>): Array<{ ts: number; value: number }> =>
    [...source.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([ts, values]) => ({
        ts,
        value: values.reduce((s, v) => s + v, 0) / values.length,
      }));

  return {
    waterLevelPoints: toAveragedSeries(waterLevelByTs),
    flowRatePoints: toAveragedSeries(flowByTs),
  };
}

export async function evaluateRunDiff(params: {
  baseRunId: string;
  candidateRunId: string;
}): Promise<Result<RunDiffResult>> {
  const [baseRun] = await db
    .select()
    .from(irrigationSimulationRun)
    .where(eq(irrigationSimulationRun.id, params.baseRunId))
    .limit(1);
  const [candidateRun] = await db
    .select()
    .from(irrigationSimulationRun)
    .where(eq(irrigationSimulationRun.id, params.candidateRunId))
    .limit(1);

  if (!baseRun || !candidateRun) {
    return err(
      createDomainError({
        code: "INVALID_INPUT",
        message: "Base run or candidate run not found.",
        retryable: false,
        context: params,
      }),
    );
  }

  const [baseSeries, candidateSeries] = await Promise.all([
    loadSeries(params.baseRunId),
    loadSeries(params.candidateRunId),
  ]);

  const waterLevelRmse = rmse(
    baseSeries.waterLevelPoints.map((p) => p.value),
    candidateSeries.waterLevelPoints.map((p) => p.value),
  );
  const flowRmse = rmse(
    baseSeries.flowRatePoints.map((p) => p.value),
    candidateSeries.flowRatePoints.map((p) => p.value),
  );

  const baseExtracted = integrateFlowVolumeM3(baseSeries.flowRatePoints);
  const candidateExtracted = integrateFlowVolumeM3(candidateSeries.flowRatePoints);
  const extractedDeltaPct =
    baseExtracted > 0
      ? Math.abs(((candidateExtracted - baseExtracted) / baseExtracted) * 100)
      : 0;

  const baseInvalid = parseInvalidCount(baseRun.qualityStateCountsJson);
  const candidateInvalid = parseInvalidCount(candidateRun.qualityStateCountsJson);
  const invalidIncrease = Math.max(0, candidateInvalid - baseInvalid);

  const violatedThresholds: string[] = [];
  let status: RunDiffResult["status"] = "PASS";

  if (
    waterLevelRmse > THRESHOLDS.warnWaterLevelRmse ||
    extractedDeltaPct > THRESHOLDS.warnExtractedDeltaPct ||
    invalidIncrease > 0
  ) {
    status = "FAIL";
    if (waterLevelRmse > THRESHOLDS.warnWaterLevelRmse) {
      violatedThresholds.push("water_level_rmse");
    }
    if (extractedDeltaPct > THRESHOLDS.warnExtractedDeltaPct) {
      violatedThresholds.push("total_extracted_delta_pct");
    }
    if (invalidIncrease > 0) {
      violatedThresholds.push("invalid_quality_state_increase");
    }
  } else if (
    waterLevelRmse > THRESHOLDS.passWaterLevelRmse ||
    extractedDeltaPct > THRESHOLDS.passExtractedDeltaPct
  ) {
    status = "WARN";
    if (waterLevelRmse > THRESHOLDS.passWaterLevelRmse) {
      violatedThresholds.push("water_level_rmse_warn");
    }
    if (extractedDeltaPct > THRESHOLDS.passExtractedDeltaPct) {
      violatedThresholds.push("total_extracted_delta_warn");
    }
  }

  return ok({
    status,
    waterLevelRmse,
    flowRmse,
    totalExtractedDeltaPercent: extractedDeltaPct,
    invalidQualityStateIncrease: invalidIncrease,
    violatedThresholds,
  });
}

export async function evaluateAndPersistRunDiff(params: {
  baseRunId: string;
  candidateRunId: string;
}): Promise<Result<RunDiffResult>> {
  const diff = await evaluateRunDiff(params);
  if (!diff.ok) {
    return diff;
  }

  await db
    .update(irrigationSimulationRun)
    .set({
      diffStatus: diff.value.status,
      diffBaseRunId: params.baseRunId,
      diffMetricsJson: {
        water_level_rmse: diff.value.waterLevelRmse,
        flow_rmse: diff.value.flowRmse,
        total_extracted_delta_percent: diff.value.totalExtractedDeltaPercent,
        invalid_quality_state_increase: diff.value.invalidQualityStateIncrease,
        violated_thresholds: diff.value.violatedThresholds,
      },
      diffComputedAt: new Date(),
    })
    .where(eq(irrigationSimulationRun.id, params.candidateRunId));

  return diff;
}
