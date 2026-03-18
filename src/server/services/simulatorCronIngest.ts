import { randomUUID } from "crypto";

import {
  type IngestReading,
  ingestReadings,
} from "~/server/services/ingestService";
import { discoverSimulatorSensors } from "~/server/services/simulatorSensorDiscovery";
import { generateSimulatorValue } from "~/server/services/simulatorValueGenerator";
import { logger } from "~/lib/logger";

const MAX_SENSORS_PER_RUN = Number.parseInt(
  process.env.SIM_CRON_MAX_SENSORS ?? "1000",
  10,
);
const WELL_CONCURRENCY = Math.max(
  1,
  Number.parseInt(process.env.SIM_CRON_WELL_CONCURRENCY ?? "8", 10),
);
const READING_CHUNK_SIZE = Math.max(
  1,
  Number.parseInt(process.env.SIM_CRON_READING_CHUNK_SIZE ?? "50", 10),
);

type SimulatorSensor = Awaited<
  ReturnType<typeof discoverSimulatorSensors>
>[number];

export type SimulatorCronOptions = {
  runId?: string;
  wellIds?: string[];
  readingsPerSensor: number;
  anomalyRate?: number;
  timestamp?: Date;
};

export type SimulatorCronResult = {
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  perWell: Record<
    string,
    {
      sensors: number;
      generated: number;
      accepted: number;
      rejected: number;
      errors: { sensorId: string; reason: string }[];
    }
  >;
  totals: {
    wells: number;
    sensors: number;
    generated: number;
    accepted: number;
    rejected: number;
  };
  summary: "ok" | "partial_failure" | "failure";
};

function repeat<T>(count: number, factory: (index: number) => T): T[] {
  const out: T[] = [];
  for (let i = 0; i < count; i += 1) out.push(factory(i));
  return out;
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

function buildReadingsForWell(params: {
  sensors: SimulatorSensor[];
  baseTimestamp: Date;
  readingsPerSensor: number;
  anomalyRate?: number;
}): IngestReading[] {
  return params.sensors.flatMap((sensor) =>
    repeat(params.readingsPerSensor, (offset) => {
      const timestamp = new Date(params.baseTimestamp);
      timestamp.setSeconds(timestamp.getSeconds() - offset);

      return {
        sensorId: sensor.sensorId,
        value: generateSimulatorValue({
          sensorId: sensor.sensorId,
          sensorType: sensor.sensorType,
          timestamp,
          anomalyRate: params.anomalyRate,
        }),
        timestamp,
        type: sensor.sensorType,
        unit: sensor.unit,
      };
    }),
  );
}

type PerWellResult = {
  wellId: string;
  sensors: number;
  generated: number;
  accepted: number;
  rejected: number;
  errors: { sensorId: string; reason: string }[];
};

async function processWell(params: {
  runId: string;
  wellId: string;
  sensors: SimulatorSensor[];
  baseTimestamp: Date;
  readingsPerSensor: number;
  anomalyRate?: number;
}): Promise<PerWellResult> {
  const readings = buildReadingsForWell({
    sensors: params.sensors,
    baseTimestamp: params.baseTimestamp,
    readingsPerSensor: params.readingsPerSensor,
    anomalyRate: params.anomalyRate,
  });

  let accepted = 0;
  let rejected = 0;
  const errors: { sensorId: string; reason: string }[] = [];

  const readingChunks = chunkArray(readings, READING_CHUNK_SIZE);
  for (const chunk of readingChunks) {
    try {
      const result = await ingestReadings(
        {
          id: `cron-${params.runId}`,
          name: "cron-simulator",
          wellId: params.wellId,
        },
        chunk,
      );

      accepted += result.accepted;
      rejected += result.rejected;
      errors.push(...result.errors);
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Chunk ingest failed";

      rejected += chunk.length;
      errors.push(
        ...chunk.map((reading) => ({
          sensorId: reading.sensorId,
          reason,
        })),
      );

      logger.error(
        {
          runId: params.runId,
          wellId: params.wellId,
          chunkSize: chunk.length,
          reason,
        },
        "simulator.cron.chunk_failed",
      );
    }
  }

  return {
    wellId: params.wellId,
    sensors: params.sensors.length,
    generated: readings.length,
    accepted,
    rejected,
    errors,
  };
}

export async function runSimulatorCron(
  options: SimulatorCronOptions,
): Promise<SimulatorCronResult> {
  const runId = options.runId ?? randomUUID();
  const started = Date.now();
  const baseTimestamp = options.timestamp ?? new Date();

  const allSensors = await discoverSimulatorSensors({
    wellIds: options.wellIds,
  });
  const limitedSensors = allSensors.slice(0, MAX_SENSORS_PER_RUN);

  const grouped = new Map<string, SimulatorSensor[]>();
  for (const sensor of limitedSensors) {
    const list = grouped.get(sensor.wellId) ?? [];
    list.push(sensor);
    grouped.set(sensor.wellId, list);
  }

  const perWell: SimulatorCronResult["perWell"] = {};
  let totalAccepted = 0;
  let totalRejected = 0;
  let totalGenerated = 0;

  logger.info(
    {
      runId,
      requestedWells: options.wellIds?.length ?? "all",
      sensorCount: limitedSensors.length,
      readingsPerSensor: options.readingsPerSensor,
    },
    "simulator.cron.start",
  );

  const entries = [...grouped.entries()];
  for (let i = 0; i < entries.length; i += WELL_CONCURRENCY) {
    const batch = entries.slice(i, i + WELL_CONCURRENCY);

    const results = await Promise.all(
      batch.map(([wellId, sensors]) =>
        processWell({
          runId,
          wellId,
          sensors,
          baseTimestamp,
          readingsPerSensor: options.readingsPerSensor,
          anomalyRate: options.anomalyRate,
        }),
      ),
    );

    for (const result of results) {
      totalGenerated += result.generated;
      totalAccepted += result.accepted;
      totalRejected += result.rejected;

      perWell[result.wellId] = {
        sensors: result.sensors,
        generated: result.generated,
        accepted: result.accepted,
        rejected: result.rejected,
        errors: result.errors,
      };
    }
  }

  const durationMs = Date.now() - started;
  const summary: SimulatorCronResult["summary"] =
    totalAccepted === 0 && totalGenerated > 0
      ? "failure"
      : totalRejected > 0
        ? "partial_failure"
        : "ok";

  logger.info(
    {
      runId,
      durationMs,
      totalGenerated,
      totalAccepted,
      totalRejected,
      summary,
    },
    "simulator.cron.complete",
  );

  return {
    runId,
    startedAt: new Date(started).toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs,
    perWell,
    totals: {
      wells: grouped.size,
      sensors: limitedSensors.length,
      generated: totalGenerated,
      accepted: totalAccepted,
      rejected: totalRejected,
    },
    summary,
  };
}
