import { db } from "../db/index";
import { sql, inArray, eq, and } from "drizzle-orm";
import { latestSensorState, well, sensors } from "../db/schema";

export type SoilSensorReading = {
  wellId: string;
  wellName: string;
  value: number;
  unit: string;
  lastUpdatedAt: Date;
};

export type SoilHistoryPoint = {
  bucket: Date;
  wellId: string;
  wellName: string;
  avgValue: number;
};

export class SoilDataRepository {
  private async getLatestByType(wellIds: string[], type: "humidity" | "temperature"): Promise<SoilSensorReading[]> {
    if (wellIds.length === 0) return [];
    
    const rows = await db
      .select({
        wellId: latestSensorState.wellId,
        wellName: well.name,
        value: latestSensorState.value,
        unit: latestSensorState.unit,
        lastUpdatedAt: latestSensorState.lastUpdatedAt,
      })
      .from(latestSensorState)
      .innerJoin(well, eq(latestSensorState.wellId, well.id))
      .where(
        and(
          inArray(latestSensorState.wellId, wellIds),
          eq(latestSensorState.type, type)
        )
      );
      
    return rows;
  }

  async getLatestHumidityByWells(wellIds: string[]): Promise<SoilSensorReading[]> {
    return this.getLatestByType(wellIds, "humidity");
  }

  async getLatestTemperatureByWells(wellIds: string[]): Promise<SoilSensorReading[]> {
    return this.getLatestByType(wellIds, "temperature");
  }

  async getHumidityHistory7d(wellIds: string[]): Promise<SoilHistoryPoint[]> {
    if (wellIds.length === 0) return [];

    // Anchor to the latest overall update for these wells (so demo data doesn't return empty for NOW())
    const anchorRes = await db.execute(sql`
      SELECT MAX(last_updated_at) as max_ts 
      FROM latest_sensor_state 
      WHERE well_id IN ${sql.join(wellIds.map(id => sql`${id}::uuid`), sql`, `)}
      AND type = 'humidity'
    `);
    
    const record = anchorRes[0] as { max_ts?: string | Date | null } | undefined;
    const maxTsStr = record?.max_ts;
    const anchorDate = maxTsStr ? new Date(maxTsStr) : new Date();

    const rangeHours = 24 * 7;
    const bucketMinutes = 24 * 60; // 1 day buckets for 7-day chart
    
    const timeFilter = sql`sd.timestamp >= ${anchorDate.toISOString()}::timestamp with time zone - (${rangeHours.toString()} || ' hours')::interval AND sd.timestamp <= ${anchorDate.toISOString()}::timestamp with time zone`;
    
    const result = await db.execute(sql`
      SELECT
        time_bucket(${bucketMinutes.toString() + " minutes"}::interval, sd.timestamp) AS bucket,
        s.well_id,
        w.name AS well_name,
        AVG(sd.value)::float AS avg_value
      FROM sensor_data sd
      JOIN sensors s ON s.id = sd.sensor_id
      JOIN well w ON w.id = s.well_id
      WHERE s.well_id IN ${sql.join(wellIds.map(id => sql`${id}::uuid`), sql`, `)}
        AND s.type = 'humidity'
        AND ${timeFilter}
      GROUP BY bucket, s.well_id, w.name
      ORDER BY bucket ASC
    `);

    return (result as unknown as { bucket: Date; well_id: string; well_name: string; avg_value: number }[]).map(r => ({
      bucket: r.bucket,
      wellId: r.well_id,
      wellName: r.well_name,
      avgValue: r.avg_value,
    }));
  }
}
