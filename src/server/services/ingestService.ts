import { and, eq, gt, isNull, sql } from "drizzle-orm";

import { db } from "~/server/db";
import {
  alertRule,
  alerts,
  latestSensorState,
  sensorData,
  sensors,
} from "~/server/db/schema";
import { type ApiKeyContext } from "~/lib/apiKeyAuth";
import {
  evaluateRules,
  type TriggeredAlert,
} from "~/server/services/alertEvalService";
import { logger } from "~/lib/logger";

export type IngestReading = {
  sensorId: string;
  value: number;
  timestamp: Date;
  unit?: string;
  type?: string;
};

type IngestResult = {
  accepted: number;
  rejected: number;
  errors: { sensorId: string; reason: string }[];
};

/**
 * Validate that the sensor exists, belongs to the API key's well (if scoped),
 * and is active.
 */
async function resolveAndValidateSensors(
  apiKeyCtx: ApiKeyContext,
  readings: IngestReading[],
): Promise<{
  validReadings: (IngestReading & {
    resolvedUnit: string;
    resolvedType: string;
    wellId: string;
  })[];
  errors: IngestResult["errors"];
}> {
  const sensorIds = [...new Set(readings.map((r) => r.sensorId))];

  const sensorRecords = await db
    .select({
      id: sensors.id,
      wellId: sensors.wellId,
      unit: sensors.unit,
      type: sensors.type,
      isActive: sensors.isActive,
    })
    .from(sensors)
    .where(
      sql`${sensors.id} = ANY(ARRAY[${sql.join(
        sensorIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )}])`,
    );

  const sensorMap = new Map(sensorRecords.map((s) => [s.id, s]));
  const validReadings: (IngestReading & {
    resolvedUnit: string;
    resolvedType: string;
    wellId: string;
  })[] = [];
  const errors: IngestResult["errors"] = [];

  for (const reading of readings) {
    const sensor = sensorMap.get(reading.sensorId);
    if (!sensor) {
      errors.push({ sensorId: reading.sensorId, reason: "Sensor not found" });
      continue;
    }
    if (!sensor.isActive) {
      errors.push({ sensorId: reading.sensorId, reason: "Sensor is inactive" });
      continue;
    }
    // If the API key is scoped to a specific well, enforce it
    if (apiKeyCtx.wellId && sensor.wellId !== apiKeyCtx.wellId) {
      errors.push({
        sensorId: reading.sensorId,
        reason: "Sensor does not belong to the authorized well",
      });
      continue;
    }
    validReadings.push({
      ...reading,
      resolvedUnit: sensor.unit,
      resolvedType: sensor.type,
      wellId: sensor.wellId,
    });
  }

  return { validReadings, errors };
}

/**
 * Check alert suppression — returns the rule IDs that are currently suppressed
 * (i.e., have an unacknowledged alert within the suppression window).
 */
async function getSuppressedRuleIds(
  dbClient: { select: typeof db.select },
  triggeredAlerts: TriggeredAlert[],
): Promise<Set<string>> {
  if (triggeredAlerts.length === 0) return new Set();

  const ruleIds = [...new Set(triggeredAlerts.map((a) => a.alertRuleId))];
  const now = new Date();

  // For each rule, check if there's an unacknowledged alert within the suppression window
  const ruleRecords = await dbClient
    .select({
      id: alertRule.id,
      suppressionWindowMinutes: alertRule.suppressionWindowMinutes,
    })
    .from(alertRule)
    .where(
      sql`${alertRule.id} = ANY(ARRAY[${sql.join(
        ruleIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )}])`,
    );

  const suppressedIds = new Set<string>();

  await Promise.all(
    ruleRecords.map(async (rule) => {
      const windowStart = new Date(
        now.getTime() - rule.suppressionWindowMinutes * 60_000,
      );
      const [existing] = await dbClient
        .select({ id: alerts.id })
        .from(alerts)
        .where(
          and(
            eq(alerts.alertRuleId, rule.id),
            isNull(alerts.acknowledgedAt),
            gt(alerts.createdAt, windowStart),
          ),
        )
        .limit(1);

      if (existing) suppressedIds.add(rule.id);
    }),
  );

  return suppressedIds;
}

/**
 * Core ingest pipeline:
 * 1. Validate sensors & ownership
 * 2. Bulk insert into sensor_data (TimescaleDB hypertable)
 * 3. UPSERT latest_sensor_state (O(1) denormalization)
 * 4. Evaluate alert rules & persist non-suppressed alerts
 */
export async function ingestReadings(
  apiKeyCtx: ApiKeyContext,
  readings: IngestReading[],
): Promise<IngestResult> {
  const { validReadings, errors } = await resolveAndValidateSensors(
    apiKeyCtx,
    readings,
  );

  if (validReadings.length === 0) {
    return { accepted: 0, rejected: readings.length, errors };
  }

  const newestPerSensorMap = new Map<string, (typeof validReadings)[number]>();
  for (const reading of validReadings) {
    const existing = newestPerSensorMap.get(reading.sensorId);
    if (
      !existing ||
      reading.timestamp.getTime() > existing.timestamp.getTime()
    ) {
      newestPerSensorMap.set(reading.sensorId, reading);
    }
  }
  const newestPerSensor = [...newestPerSensorMap.values()];

  const wellIds = [...new Set(validReadings.map((r) => r.wellId))];

  await db.transaction(async (tx) => {
    // 1. Bulk insert into hypertable
    await tx
      .insert(sensorData)
      .values(
        validReadings.map((r) => ({
          sensorId: r.sensorId,
          value: r.value,
          timestamp: r.timestamp,
        })),
      )
      .onConflictDoNothing({
        target: [sensorData.sensorId, sensorData.timestamp],
      });

    // 2. UPSERT latest_sensor_state (only advance if newer)
    await tx
      .insert(latestSensorState)
      .values(
        newestPerSensor.map((r) => ({
          sensorId: r.sensorId,
          wellId: r.wellId,
          value: r.value,
          unit: r.resolvedUnit as never,
          type: r.resolvedType as never,
          lastUpdatedAt: r.timestamp,
        })),
      )
      .onConflictDoUpdate({
        target: latestSensorState.sensorId,
        set: {
          value: sql`EXCLUDED.value`,
          lastUpdatedAt: sql`EXCLUDED.last_updated_at`,
          wellId: sql`EXCLUDED.well_id`,
          unit: sql`EXCLUDED.unit`,
          type: sql`EXCLUDED.type`,
        },
        // Only update if the incoming reading is newer
        setWhere: sql`EXCLUDED.last_updated_at > latest_sensor_state.last_updated_at`,
      });

    // 3. Evaluate alert rules
    const applicableRules = await tx
      .select()
      .from(alertRule)
      .where(
        and(
          sql`${alertRule.wellId} = ANY(ARRAY[${sql.join(
            wellIds.map((id) => sql`${id}::uuid`),
            sql`, `,
          )}])`,
          eq(alertRule.isActive, true),
        ),
      );

    const allTriggered: TriggeredAlert[] = validReadings.flatMap((r) =>
      evaluateRules(applicableRules, {
        sensorId: r.sensorId,
        wellId: r.wellId,
        value: r.value,
        type: r.resolvedType,
      }),
    );

    if (allTriggered.length > 0) {
      const suppressedRuleIds = await getSuppressedRuleIds(tx, allTriggered);
      const alertsToInsert = allTriggered.filter(
        (a) => !suppressedRuleIds.has(a.alertRuleId),
      );

      if (alertsToInsert.length > 0) {
        await tx.insert(alerts).values(
          alertsToInsert.map((a) => ({
            wellId: a.wellId,
            sensorId: a.sensorId,
            type: a.type as never,
            severity: a.severity,
            message: a.message,
            alertRuleId: a.alertRuleId,
          })),
        );

        logger.info(
          { count: alertsToInsert.length, wellIds },
          "alerts.inserted",
        );
      }
    }
  });

  logger.info(
    { accepted: validReadings.length, rejected: errors.length },
    "ingest.complete",
  );

  return {
    accepted: validReadings.length,
    rejected: errors.length,
    errors,
  };
}
