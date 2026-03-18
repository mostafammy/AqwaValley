import { and, eq, inArray } from "drizzle-orm";

import { db } from "~/server/db";
import { sensors, well } from "~/server/db/schema";

export type SimulatorSensor = {
  sensorId: string;
  wellId: string;
  sensorType: string;
  unit: string;
};

export async function discoverSimulatorSensors(options?: {
  wellIds?: string[];
}): Promise<SimulatorSensor[]> {
  const where = options?.wellIds?.length
    ? and(
        eq(sensors.isActive, true),
        eq(well.status, "active"),
        inArray(sensors.wellId, options.wellIds),
      )
    : and(eq(sensors.isActive, true), eq(well.status, "active"));

  return db
    .select({
      sensorId: sensors.id,
      wellId: sensors.wellId,
      sensorType: sensors.type,
      unit: sensors.unit,
    })
    .from(sensors)
    .innerJoin(well, eq(sensors.wellId, well.id))
    .where(where);
}
