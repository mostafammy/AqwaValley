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

export type SimulatorCronOptions = {
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

export async function runSimulatorCron(
  options: SimulatorCronOptions,
): Promise<SimulatorCronResult> {
  const runId = randomUUID();
  const started = Date.now();
  const baseTimestamp = options.timestamp ?? new Date();

  const allSensors = await discoverSimulatorSensors({
    wellIds: options.wellIds,
  });
  const limitedSensors = allSensors.slice(0, MAX_SENSORS_PER_RUN);

  const grouped = new Map<string, typeof limitedSensors>();
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

  for (const [wellId, sensors] of grouped.entries()) {
    const readings: IngestReading[] = sensors.flatMap((sensor) =>
      repeat(options.readingsPerSensor, (offset) => {
        const timestamp = new Date(baseTimestamp);
        timestamp.setSeconds(timestamp.getSeconds() - offset);

        return {
          sensorId: sensor.sensorId,
          value: generateSimulatorValue({
            sensorId: sensor.sensorId,
            sensorType: sensor.sensorType,
            timestamp,
            anomalyRate: options.anomalyRate,
          }),
          timestamp,
          type: sensor.sensorType,
          unit: sensor.unit,
        };
      }),
    );

    totalGenerated += readings.length;

    const result = await ingestReadings(
      { id: `cron-${runId}`, name: "cron-simulator", wellId },
      readings,
    );

    totalAccepted += result.accepted;
    totalRejected += result.rejected;

    perWell[wellId] = {
      sensors: sensors.length,
      generated: readings.length,
      accepted: result.accepted,
      rejected: result.rejected,
      errors: result.errors,
    };
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
