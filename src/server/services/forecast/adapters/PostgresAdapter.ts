import { and, eq, gte, inArray, lte } from "drizzle-orm";

import type { db as DbInstance } from "~/server/db";
import { district, sensorData, sensors } from "~/server/db/schema";
import type { DataSourceAdapter } from "~/server/services/forecast/adapters/DataSourceAdapter";
import type {
  DistrictSeries,
  ExternalReferenceObservation,
  TimeWindow,
  WellReading,
  WellSeries,
} from "~/server/services/forecast/types";

type Db = typeof DbInstance;

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export class PostgresAdapter implements DataSourceAdapter {
  public readonly sourceName = "postgres";

  public constructor(private readonly db: Db) {}

  public async loadDistrictSeries(
    districtIds: string[],
    _window: TimeWindow,
  ): Promise<DistrictSeries[]> {
    if (districtIds.length === 0) return [];

    const rows = await this.db
      .select({
        districtId: district.id,
        districtName: district.name,
        baselineDepthM: district.baselineDepthM,
        annualDepletionRateM: district.annualDepletionRateM,
        safeYieldM3Yr: district.safeYieldM3Yr,
        warningThresholdPct: district.warningThresholdPct,
        criticalThresholdPct: district.criticalThresholdPct,
      })
      .from(district)
      .where(inArray(district.id, districtIds));

    return rows.map((row) => ({
      districtId: row.districtId,
      districtName: row.districtName,
      baselineDepthM: toNumber(row.baselineDepthM),
      annualDepletionRateM: toNumber(row.annualDepletionRateM),
      safeYieldM3Yr: toNumber(row.safeYieldM3Yr),
      warningThresholdPct: toNumber(row.warningThresholdPct),
      criticalThresholdPct: toNumber(row.criticalThresholdPct),
    }));
  }

  public async loadWellTimeseries(
    wellIds: string[],
    window: TimeWindow,
  ): Promise<WellSeries[]> {
    if (wellIds.length === 0) return [];

    const rows = await this.db
      .select({
        wellId: sensors.wellId,
        sensorId: sensorData.sensorId,
        timestamp: sensorData.timestamp,
        value: sensorData.value,
      })
      .from(sensorData)
      .innerJoin(sensors, eq(sensorData.sensorId, sensors.id))
      .where(
        and(
          inArray(sensors.wellId, wellIds),
          gte(sensorData.timestamp, window.start),
          lte(sensorData.timestamp, window.end),
        ),
      );

    const readingsByWell = new Map<string, WellReading[]>();
    for (const row of rows) {
      const bucket = readingsByWell.get(row.wellId) ?? [];
      bucket.push({
        wellId: row.wellId,
        sensorId: row.sensorId,
        timestamp: row.timestamp,
        value: row.value,
      });
      readingsByWell.set(row.wellId, bucket);
    }

    return wellIds.map((wellId) => ({
      wellId,
      readings: readingsByWell.get(wellId) ?? [],
    }));
  }

  public async loadExternalReferenceSeries(
    _districtIds: string[],
    _window: TimeWindow,
  ): Promise<ExternalReferenceObservation[]> {
    return [];
  }
}
