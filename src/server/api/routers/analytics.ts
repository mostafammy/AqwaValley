import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, viewerProcedure } from "~/server/api/trpc";
import { getAccessibleDistrictIds, requireWellAccess } from "~/server/lib/abac";
import {
  alerts,
  district,
  latestSensorState,
  sensors,
  well,
} from "~/server/db/schema";

const rangeValues = ["1h", "24h", "7d", "30d"] as const;
const bucketValues = ["1h", "1d"] as const;

export const analyticsRouter = createTRPCRouter({
  /**
   * Time-bucketed avg / min / max for a specific sensor on a well.
   * Queries TimescaleDB's time_bucket() function for efficient aggregation.
   */
  wellMetrics: viewerProcedure
    .input(
      z.object({
        wellId: z.string().uuid(),
        sensorType: z
          .enum([
            "water_level",
            "pressure",
            "flow_rate",
            "temperature",
            "humidity",
          ])
          .optional(),
        range: z.enum(rangeValues).default("24h"),
        bucket: z.enum(bucketValues).default("1h"),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireWellAccess(ctx, input.wellId);

      const rangeMs: Record<(typeof rangeValues)[number], number> = {
        "1h": 3_600_000,
        "24h": 86_400_000,
        "7d": 604_800_000,
        "30d": 2_592_000_000,
      };
      const bucketInterval: Record<(typeof bucketValues)[number], string> = {
        "1h": "1 hour",
        "1d": "1 day",
      };

      const since = new Date(Date.now() - rangeMs[input.range]);
      const bucketSql = bucketInterval[input.bucket];

      // Resolve sensor IDs for this well
      const sensorConditions = [eq(sensors.wellId, input.wellId)];
      if (input.sensorType)
        sensorConditions.push(eq(sensors.type, input.sensorType));

      const wellSensors = await ctx.db
        .select({ id: sensors.id, type: sensors.type, unit: sensors.unit })
        .from(sensors)
        .where(and(...sensorConditions));

      if (!wellSensors.length) return [];

      const sensorIds = wellSensors.map((s) => s.id);
      // Use TimescaleDB time_bucket for efficient aggregation
      const rows = await ctx.db.execute(sql`
        SELECT
          time_bucket(${bucketSql}::interval, timestamp) AS bucket,
          sensor_id,
          AVG(value)   AS avg_value,
          MIN(value)   AS min_value,
          MAX(value)   AS max_value,
          COUNT(*)     AS reading_count
        FROM sensor_data
        WHERE sensor_id = ANY(${sql.raw(`ARRAY['${sensorIds.join("','")}']::uuid[]`)})
          AND timestamp >= ${since.toISOString()}::timestamptz
        GROUP BY bucket, sensor_id
        ORDER BY bucket ASC
      `);

      const sensorMeta = new Map(wellSensors.map((s) => [s.id, s]));

      return (rows as Array<Record<string, unknown>>).map((row) => ({
        bucket: row.bucket,
        sensorId: row.sensor_id as string,
        sensorType: sensorMeta.get(row.sensor_id as string)?.type,
        unit: sensorMeta.get(row.sensor_id as string)?.unit,
        avgValue: Number(row.avg_value),
        minValue: Number(row.min_value),
        maxValue: Number(row.max_value),
        readingCount: Number(row.reading_count),
      }));
    }),

  /**
   * District-level summary: total wells, active wells, alert count,
   * average water level using the denormalized latest_sensor_state table (O(1)).
   */
  districtSummary: viewerProcedure
    .input(z.object({ districtId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const accessible = await getAccessibleDistrictIds(ctx);
      if (accessible !== null && !accessible.includes(input.districtId)) {
        const { TRPCError } = await import("@trpc/server");
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access to this district is not permitted",
        });
      }

      const [districtInfo, wellStats, alertStats, levelStats] =
        await Promise.all([
          ctx.db
            .select()
            .from(district)
            .where(eq(district.id, input.districtId))
            .limit(1),

          ctx.db
            .select({
              total: sql<number>`count(*)`,
              active: sql<number>`count(*) filter (where status = 'active')`,
            })
            .from(well)
            .where(eq(well.districtId, input.districtId)),

          ctx.db
            .select({ total: sql<number>`count(*)` })
            .from(alerts)
            .innerJoin(well, eq(alerts.wellId, well.id))
            .where(
              and(
                eq(well.districtId, input.districtId),
                sql`${alerts.acknowledgedAt} IS NULL`,
              ),
            ),

          // Average current water level from latest_sensor_state
          ctx.db.execute(sql`
            SELECT AVG(lss.value) AS avg_level
            FROM latest_sensor_state lss
            INNER JOIN sensors s ON s.id = lss.sensor_id
            INNER JOIN well w ON w.id = lss.well_id
            WHERE w.district_id = ${input.districtId}::uuid
              AND s.type = 'water_level'
          `),
        ]);

      return {
        district: districtInfo[0] ?? null,
        totalWells: Number(wellStats[0]?.total ?? 0),
        activeWells: Number(wellStats[0]?.active ?? 0),
        unacknowledgedAlerts: Number(alertStats[0]?.total ?? 0),
        avgWaterLevelM: levelStats[0] ? Number(levelStats[0].avg_level) : null,
      };
    }),

  /**
   * Raw sensor trend data with time_bucket granularity.
   * Useful for longer-range charts and anomaly detection overlays.
   */
  wellTrend: viewerProcedure
    .input(
      z.object({
        wellId: z.string().uuid(),
        sensorType: z.enum([
          "water_level",
          "pressure",
          "flow_rate",
          "temperature",
          "humidity",
        ]),
        from: z.date(),
        to: z.date(),
        bucketMinutes: z.number().int().min(1).max(1440).default(60),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireWellAccess(ctx, input.wellId);

      const sensor = await ctx.db
        .select({ id: sensors.id, unit: sensors.unit })
        .from(sensors)
        .where(
          and(
            eq(sensors.wellId, input.wellId),
            eq(sensors.type, input.sensorType),
            eq(sensors.isActive, true),
          ),
        )
        .limit(1);

      if (!sensor[0]) return { series: [], unit: null };

      const rows = await ctx.db.execute(sql`
        SELECT
          time_bucket(${`${input.bucketMinutes} minutes`}::interval, timestamp) AS bucket,
          AVG(value) AS avg_value
        FROM sensor_data
        WHERE sensor_id = ${sensor[0].id}::uuid
          AND timestamp BETWEEN ${input.from.toISOString()}::timestamptz
                             AND ${input.to.toISOString()}::timestamptz
        GROUP BY bucket
        ORDER BY bucket ASC
      `);

      return {
        sensorId: sensor[0].id,
        unit: sensor[0].unit,
        series: (rows as Array<Record<string, unknown>>).map((r) => ({
          bucket: r.bucket,
          avgValue: Number(r.avg_value),
        })),
      };
    }),

  /**
   * Latest sensor values for all wells in a list — dashboard O(1) read.
   */
  latestStates: viewerProcedure
    .input(
      z.object({
        wellIds: z.array(z.string().uuid()).min(1).max(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      const accessibleDistricts = await getAccessibleDistrictIds(ctx);

      let scopedWellIds = input.wellIds;
      if (accessibleDistricts !== null) {
        if (accessibleDistricts.length === 0) {
          return [];
        }

        const accessibleWells = await ctx.db
          .select({ id: well.id })
          .from(well)
          .where(
            and(
              inArray(well.id, input.wellIds),
              inArray(well.districtId, accessibleDistricts),
            ),
          );

        scopedWellIds = accessibleWells.map((w) => w.id);
      }

      if (scopedWellIds.length === 0) {
        return [];
      }

      const rows = await ctx.db
        .select({
          sensorId: latestSensorState.sensorId,
          wellId: latestSensorState.wellId,
          value: latestSensorState.value,
          unit: latestSensorState.unit,
          type: latestSensorState.type,
          lastUpdatedAt: latestSensorState.lastUpdatedAt,
        })
        .from(latestSensorState)
        .where(inArray(latestSensorState.wellId, scopedWellIds));

      return rows;
    }),
});
