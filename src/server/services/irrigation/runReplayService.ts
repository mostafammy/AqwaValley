import { sql } from "drizzle-orm";

import { db } from "~/server/db";
import { simulateIrrigationRun } from "./simulateIrrigationRun";
import { computeRunOutputHash } from "./runOutputHash";
import { createDomainError, err, ok, type Result } from "./simulation";

type StoredEnvelope = {
  farmId: string;
  irrigationEventId: string;
  wellIds: string[];
  durationMinutes: number;
  areaM2: number;
  startTimestamp: string;
  baseFlowRateM3s: number;
  initialWaterLevelM?: number;
  initialWaterDebtM3?: number;
  pressureTimeSeriesJson?: Array<{
    elapsedSeconds: number;
    pressurePa: number;
  }>;
};

type StoredProviderSnapshot = {
  weather: {
    et0_value_si: number;
    source: string;
    freshness: string;
    age_minutes: number;
    provider_timestamp: string;
    provider_version: string;
  };
  crop: {
    crop_type: string;
    growth_stage: string;
    kc_value: number;
    stress_coefficient?: number;
    provider_version: string;
  };
  soil: {
    soil_type: string;
    ks_value_si: number;
    field_capacity_depth_m: number;
    provider_version: string;
  };
};

type RunReplayDbRow = {
  id: string;
  input_envelope_json: unknown;
  provider_snapshot_json: unknown;
  trajectory_hash: string | null;
};

function syntheticPressurePa(elapsedSeconds: number): number {
  return 200_000 + Math.sin(elapsedSeconds / 300) * 10_000;
}

function parsePressureSeries(
  input: unknown,
): Array<{ elapsedSeconds: number; pressurePa: number }> | undefined {
  if (!Array.isArray(input)) return undefined;

  const parsed = input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const elapsedSeconds = record.elapsedSeconds;
      const pressurePa = record.pressurePa;

      if (
        typeof elapsedSeconds !== "number" ||
        !Number.isFinite(elapsedSeconds) ||
        typeof pressurePa !== "number" ||
        !Number.isFinite(pressurePa)
      ) {
        return null;
      }

      return { elapsedSeconds, pressurePa };
    })
    .filter(
      (item): item is { elapsedSeconds: number; pressurePa: number } =>
        item !== null,
    )
    .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds);

  return parsed.length > 0 ? parsed : undefined;
}

function resolvePressurePa(params: {
  elapsedSeconds: number;
  pressureSeries?: Array<{ elapsedSeconds: number; pressurePa: number }>;
}): number {
  const series = params.pressureSeries;
  if (!series || series.length === 0) {
    return syntheticPressurePa(params.elapsedSeconds);
  }

  if (series.length === 1) {
    return series[0]!.pressurePa;
  }

  const target = params.elapsedSeconds;

  if (target <= series[0]!.elapsedSeconds) {
    return series[0]!.pressurePa;
  }

  const last = series[series.length - 1]!;
  if (target >= last.elapsedSeconds) {
    return last.pressurePa;
  }

  for (let i = 1; i < series.length; i += 1) {
    const right = series[i]!;
    const left = series[i - 1]!;

    if (target <= right.elapsedSeconds) {
      const span = right.elapsedSeconds - left.elapsedSeconds;
      if (span <= 0) return right.pressurePa;
      const t = (target - left.elapsedSeconds) / span;
      return left.pressurePa + t * (right.pressurePa - left.pressurePa);
    }
  }

  return syntheticPressurePa(target);
}

function parseEnvelope(input: unknown): StoredEnvelope | null {
  if (!input || typeof input !== "object") return null;
  const v = input as Record<string, unknown>;
  if (
    typeof v.startTimestamp !== "string" ||
    typeof v.durationMinutes !== "number" ||
    typeof v.areaM2 !== "number" ||
    typeof v.baseFlowRateM3s !== "number"
  ) {
    return null;
  }

  return {
    farmId: typeof v.farmId === "string" ? v.farmId : "",
    irrigationEventId:
      typeof v.irrigationEventId === "string" ? v.irrigationEventId : "",
    wellIds: Array.isArray(v.wellIds)
      ? v.wellIds.filter((item): item is string => typeof item === "string")
      : [],
    durationMinutes: v.durationMinutes,
    areaM2: v.areaM2,
    startTimestamp: v.startTimestamp,
    baseFlowRateM3s: v.baseFlowRateM3s,
    initialWaterLevelM:
      typeof v.initialWaterLevelM === "number" &&
      Number.isFinite(v.initialWaterLevelM)
        ? v.initialWaterLevelM
        : undefined,
    initialWaterDebtM3:
      typeof v.initialWaterDebtM3 === "number" &&
      Number.isFinite(v.initialWaterDebtM3)
        ? v.initialWaterDebtM3
        : undefined,
    pressureTimeSeriesJson: parsePressureSeries(v.pressureTimeSeriesJson),
  };
}

function parseProviderSnapshot(input: unknown): StoredProviderSnapshot | null {
  if (!input || typeof input !== "object") return null;
  const root = input as Record<string, unknown>;
  const weather = root.weather as Record<string, unknown> | undefined;
  const crop = root.crop as Record<string, unknown> | undefined;
  const soil = root.soil as Record<string, unknown> | undefined;

  if (!weather || !crop || !soil) return null;
  if (
    typeof weather.et0_value_si !== "number" ||
    typeof crop.kc_value !== "number" ||
    typeof soil.ks_value_si !== "number" ||
    typeof soil.field_capacity_depth_m !== "number"
  ) {
    return null;
  }

  return {
    weather: {
      et0_value_si: weather.et0_value_si,
      source: typeof weather.source === "string" ? weather.source : "unknown",
      freshness:
        typeof weather.freshness === "string" ? weather.freshness : "unknown",
      age_minutes:
        typeof weather.age_minutes === "number" ? weather.age_minutes : 0,
      provider_timestamp:
        typeof weather.provider_timestamp === "string"
          ? weather.provider_timestamp
          : new Date(0).toISOString(),
      provider_version:
        typeof weather.provider_version === "string"
          ? weather.provider_version
          : "unknown",
    },
    crop: {
      crop_type:
        typeof crop.crop_type === "string" ? crop.crop_type : "unknown",
      growth_stage:
        typeof crop.growth_stage === "string" ? crop.growth_stage : "unknown",
      kc_value: crop.kc_value,
      stress_coefficient:
        typeof crop.stress_coefficient === "number"
          ? crop.stress_coefficient
          : undefined,
      provider_version:
        typeof crop.provider_version === "string"
          ? crop.provider_version
          : "unknown",
    },
    soil: {
      soil_type:
        typeof soil.soil_type === "string" ? soil.soil_type : "unknown",
      ks_value_si: soil.ks_value_si,
      field_capacity_depth_m: soil.field_capacity_depth_m,
      provider_version:
        typeof soil.provider_version === "string"
          ? soil.provider_version
          : "unknown",
    },
  };
}

async function persistReplayResult(params: {
  runId: string;
  status: "MATCH" | "NONDETERMINISTIC" | "ERROR";
  outputHash: string | null;
  errorMessage: string | null;
}): Promise<void> {
  await db.execute(sql`
    update irrigation_simulation_run
    set replay_last_status = ${params.status},
        replay_last_output_hash = ${params.outputHash},
        replay_last_error = ${params.errorMessage},
        replay_last_checked_at = now()
    where id = ${params.runId}
  `);
}

export async function replaySimulationRun(runId: string): Promise<
  Result<{
    runId: string;
    replayStatus: "MATCH" | "NONDETERMINISTIC";
    expectedOutputHash: string | null;
    replayOutputHash: string;
  }>
> {
  const rows = await db.execute(sql<RunReplayDbRow>`
    select
      id,
      input_envelope_json,
      provider_snapshot_json,
      trajectory_hash
    from irrigation_simulation_run
    where id = ${runId}
    limit 1
  `);

  const runRecord = rows[0] as RunReplayDbRow | undefined;
  if (!runRecord) {
    return err(
      createDomainError({
        code: "INVALID_INPUT",
        message: "Simulation run not found.",
        retryable: false,
        context: { runId },
      }),
    );
  }

  const envelope = parseEnvelope(runRecord.input_envelope_json);
  const providerSnapshot = parseProviderSnapshot(
    runRecord.provider_snapshot_json,
  );

  if (!envelope || !providerSnapshot) {
    const message = "Replay envelope/provider snapshot missing or invalid.";
    await persistReplayResult({
      runId,
      status: "ERROR",
      outputHash: null,
      errorMessage: message,
    });

    return err(
      createDomainError({
        code: "INVALID_INPUT",
        message,
        retryable: false,
        context: { runId },
      }),
    );
  }

  const runResult = simulateIrrigationRun({
    startTimestamp: new Date(envelope.startTimestamp),
    horizonSeconds: envelope.durationMinutes * 60,
    areaM2: envelope.areaM2,
    initialWaterLevelM: envelope.initialWaterLevelM ?? 1,
    initialWaterDebtM3: envelope.initialWaterDebtM3 ?? 0,
    getHydrologyInputsAt: ({ elapsedSeconds }) => ({
      et0DepthRateMps: providerSnapshot.weather.et0_value_si,
      kc: providerSnapshot.crop.kc_value,
      stressCoefficient: providerSnapshot.crop.stress_coefficient ?? 0.9,
      drainageCoefficientPerSecond: providerSnapshot.soil.ks_value_si,
      fieldCapacityDepthM: providerSnapshot.soil.field_capacity_depth_m,
      valveOpen: true,
      inflowMode: "pressure_aware",
      baseFlowRateM3s: envelope.baseFlowRateM3s,
      pressurePa: resolvePressurePa({
        elapsedSeconds,
        pressureSeries: envelope.pressureTimeSeriesJson,
      }),
      nominalPressurePa: 200_000,
      maxPressureMultiplier: 1.2,
    }),
  });

  if (!runResult.ok) {
    await persistReplayResult({
      runId,
      status: "ERROR",
      outputHash: null,
      errorMessage: runResult.error.message,
    });

    return err(runResult.error);
  }

  const expectedOutputHash =
    typeof runRecord.trajectory_hash === "string"
      ? runRecord.trajectory_hash
      : null;
  const replayOutputHash = computeRunOutputHash(runResult.value);
  const replayStatus: "MATCH" | "NONDETERMINISTIC" =
    expectedOutputHash === replayOutputHash ? "MATCH" : "NONDETERMINISTIC";

  await persistReplayResult({
    runId,
    status: replayStatus,
    outputHash: replayOutputHash,
    errorMessage:
      replayStatus === "NONDETERMINISTIC"
        ? "Replay output hash mismatch against stored trajectory hash."
        : null,
  });

  return ok({
    runId,
    replayStatus,
    expectedOutputHash,
    replayOutputHash,
  });
}
