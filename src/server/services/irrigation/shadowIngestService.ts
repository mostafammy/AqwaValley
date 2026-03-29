import { db } from "~/server/db";
import { sensorDataSimulation } from "~/server/db/schema";

export type ShadowSimulationReading = {
  sensorId: string;
  value: number;
  timestamp: Date;
};

export async function writeSimulationReadings(params: {
  simulationRunId: string;
  irrigationEventId: string;
  generatorVersion: string;
  readings: ShadowSimulationReading[];
  chunkSize?: number;
}): Promise<{ inserted: number }> {
  if (params.readings.length === 0) {
    return { inserted: 0 };
  }

  const chunkSize = Math.max(1, params.chunkSize ?? 500);
  let inserted = 0;

  for (let i = 0; i < params.readings.length; i += chunkSize) {
    const chunk = params.readings.slice(i, i + chunkSize);

    const insertedRows = await db
      .insert(sensorDataSimulation)
      .values(
        chunk.map((reading) => ({
          sensorId: reading.sensorId,
          simulationRunId: params.simulationRunId,
          irrigationEventId: params.irrigationEventId,
          source: "SIMULATION" as const,
          value: reading.value,
          timestamp: reading.timestamp,
          generatedAt: new Date(),
          generatorVersion: params.generatorVersion,
        })),
      )
      .onConflictDoNothing({
        target: [
          sensorDataSimulation.simulationRunId,
          sensorDataSimulation.sensorId,
          sensorDataSimulation.timestamp,
        ],
      })
      .returning({
        sensorId: sensorDataSimulation.sensorId,
      });

    inserted += insertedRows.length;
  }

  return { inserted };
}
