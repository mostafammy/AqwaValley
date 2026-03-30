/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import "./env-loader.mjs";
import { eq, inArray, like } from "drizzle-orm";
import { NextRequest } from "next/server";

import { db } from "../src/server/db";
import * as schema from "../src/server/db/schema";
import { createForecastRuntime } from "../src/server/services/forecast/runtime";
import * as forecastCronRoute from "../src/app/api/cron/aquifer-forecast/route";

type RiskRow = {
  id: string;
  modelVersionId: string;
  runId: string;
  flagType: string;
  pointForecast: unknown;
  interval80: unknown;
  interval95: unknown;
};

function logStep(message: string): void {
  console.log(`[forecast-integration] ${message}`);
}

async function main() {
  process.env.CRON_SECRET ??= "forecast-test-cron-secret";

  const fixtureTag = `forecast-itest-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const districtId = randomUUID();
  const wellId = randomUUID();
  const sensorId = randomUUID();

  const runKey = `${fixtureTag}:idempotency`;
  const cronPrefix = `${fixtureTag}:cron`;
  const sourceSnapshotId = `${fixtureTag}:snapshot`;

  const now = new Date();
  const readingRows: Array<{
    sensorId: string;
    value: number;
    timestamp: Date;
  }> = [];

  for (let i = 0; i < 45; i++) {
    const ts = new Date(now);
    ts.setUTCDate(ts.getUTCDate() - (45 - i));
    // Use a deterministic low positive slope that remains under plausibility
    // depletion thresholds across 5/10/25-year extrapolated horizon deltas.
    const trend = 72 + i * 0.0002;
    const seasonal = 0;
    readingRows.push({
      sensorId,
      value: Number((trend + seasonal).toFixed(4)),
      timestamp: ts,
    });
  }

  const cleanup = async () => {
    await db
      .delete(schema.aquiferRiskFlag)
      .where(eq(schema.aquiferRiskFlag.scopeId, districtId));

    await db
      .delete(schema.aquiferModelReferenceObservationLink)
      .where(
        inArray(
          schema.aquiferModelReferenceObservationLink.modelVersionId,
          db
            .select({ id: schema.aquiferLinearRegressionModel.id })
            .from(schema.aquiferLinearRegressionModel)
            .where(eq(schema.aquiferLinearRegressionModel.scopeId, districtId)),
        ),
      );

    await db
      .delete(schema.aquiferLinearRegressionModel)
      .where(eq(schema.aquiferLinearRegressionModel.scopeId, districtId));

    await db
      .delete(schema.aquiferExternalReferenceObservation)
      .where(
        like(
          schema.aquiferExternalReferenceObservation.sourceSnapshotId,
          `${fixtureTag}%`,
        ),
      );

    await db
      .delete(schema.aquiferForecastRun)
      .where(like(schema.aquiferForecastRun.runKey, `${fixtureTag}%`));

    await db
      .delete(schema.sensorData)
      .where(eq(schema.sensorData.sensorId, sensorId));

    await db.delete(schema.sensors).where(eq(schema.sensors.id, sensorId));
    await db.delete(schema.well).where(eq(schema.well.id, wellId));
    await db.delete(schema.district).where(eq(schema.district.id, districtId));
  };

  await cleanup();

  try {
    logStep("creating fixture district/well/sensor/telemetry");

    await db.insert(schema.district).values({
      id: districtId,
      name: `${fixtureTag}-district`,
      baselineDepthM: "150.00",
      warningThresholdPct: "70.00",
      criticalThresholdPct: "85.00",
      safeYieldM3Yr: "250000.00",
    });

    await db.insert(schema.well).values({
      id: wellId,
      districtId,
      name: `${fixtureTag}-well`,
      latitude: "25.45000000",
      longitude: "30.55000000",
      status: "active",
      hasSensor: true,
    });

    await db.insert(schema.sensors).values({
      id: sensorId,
      wellId,
      type: "water_level",
      unit: "meters",
      isActive: true,
      name: `${fixtureTag}-sensor`,
    });

    await db.insert(schema.sensorData).values(readingRows);

    const runtime = createForecastRuntime(db, undefined, {
      externalObservationProvider: async () => [
        {
          sourceSystem: "CEDARE",
          stationId: `${fixtureTag}-station-1`,
          districtId,
          wellId,
          observedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          metricType: "aquifer_level",
          value: 64.2,
          unit: "meters",
          mappingConfidence: 0.94,
          sourceSnapshotId,
        },
      ],
    });

    logStep("asserting orchestrator idempotency replay behavior");

    const firstRun = await runtime.runDistrictForecast({
      districtId,
      runKey,
      triggerType: "manual",
    });

    assert.equal(
      firstRun.status,
      "completed",
      `expected completed run but got ${firstRun.status} (${firstRun.failureReason ?? "no_reason"})`,
    );
    assert.equal(firstRun.replay, false);
    assert.ok(firstRun.modelId, "first run must return modelId");

    const replayRun = await runtime.runDistrictForecast({
      districtId,
      runKey,
      triggerType: "manual",
    });

    assert.equal(replayRun.status, "completed");
    assert.equal(replayRun.replay, true);

    const persistedRuns = await db
      .select({ id: schema.aquiferForecastRun.id })
      .from(schema.aquiferForecastRun)
      .where(eq(schema.aquiferForecastRun.runKey, runKey));

    assert.equal(persistedRuns.length, 1, "run must be persisted once");

    const persistedModelRows = await db
      .select({
        id: schema.aquiferLinearRegressionModel.id,
        slope: schema.aquiferLinearRegressionModel.slope,
        intercept: schema.aquiferLinearRegressionModel.intercept,
        sampleCount: schema.aquiferLinearRegressionModel.sampleCount,
        rSquared: schema.aquiferLinearRegressionModel.rSquared,
        dataCompletenessPct:
          schema.aquiferLinearRegressionModel.dataCompletenessPct,
        outlierRatioPct: schema.aquiferLinearRegressionModel.outlierRatioPct,
      })
      .from(schema.aquiferLinearRegressionModel)
      .where(eq(schema.aquiferLinearRegressionModel.id, firstRun.modelId));

    assert.equal(persistedModelRows.length, 1, "model row must exist");
    assert.ok(
      Number(persistedModelRows[0]!.sampleCount) > 0,
      "model sampleCount must be persisted",
    );
    assert.notEqual(
      Number(persistedModelRows[0]!.slope),
      0,
      "model slope must not be default zero",
    );
    assert.ok(
      persistedModelRows[0]!.rSquared !== null,
      "model rSquared must be persisted",
    );

    const riskRows: RiskRow[] = await db
      .select({
        id: schema.aquiferRiskFlag.id,
        modelVersionId: schema.aquiferRiskFlag.modelVersionId,
        runId: schema.aquiferRiskFlag.runId,
        flagType: schema.aquiferRiskFlag.flagType,
        pointForecast: schema.aquiferRiskFlag.pointForecast,
        interval80: schema.aquiferRiskFlag.interval80,
        interval95: schema.aquiferRiskFlag.interval95,
      })
      .from(schema.aquiferRiskFlag)
      .where(eq(schema.aquiferRiskFlag.scopeId, districtId));

    assert.equal(
      riskRows.length,
      4,
      "must persist 3 horizon + 1 composite flags",
    );
    const horizonRows = riskRows.filter((r) => r.flagType !== "SQ13_COMPOSITE");
    assert.equal(horizonRows.length, 3);
    for (const row of horizonRows) {
      assert.equal(row.modelVersionId, firstRun.modelId);
      assert.ok(row.pointForecast !== null, "horizon point forecast missing");
      assert.ok(row.interval80 !== null, "horizon interval80 missing");
      assert.ok(row.interval95 !== null, "horizon interval95 missing");
    }

    logStep("asserting risk lineage integrity");

    const lineageLinks = await db
      .select({
        modelVersionId:
          schema.aquiferModelReferenceObservationLink.modelVersionId,
        observationId:
          schema.aquiferModelReferenceObservationLink.observationId,
      })
      .from(schema.aquiferModelReferenceObservationLink)
      .where(
        eq(
          schema.aquiferModelReferenceObservationLink.modelVersionId,
          firstRun.modelId,
        ),
      );

    assert.ok(lineageLinks.length > 0, "lineage links must be persisted");

    const linkedObservationIds = lineageLinks.map((link) => link.observationId);

    const lineageObservations = await db
      .select({
        id: schema.aquiferExternalReferenceObservation.id,
        sourceSnapshotId:
          schema.aquiferExternalReferenceObservation.sourceSnapshotId,
      })
      .from(schema.aquiferExternalReferenceObservation)
      .where(
        inArray(
          schema.aquiferExternalReferenceObservation.id,
          linkedObservationIds,
        ),
      );

    assert.equal(
      lineageObservations.length,
      lineageLinks.length,
      "every lineage link must resolve to an external observation",
    );
    assert.ok(
      lineageObservations.every(
        (obs) => obs.sourceSnapshotId === sourceSnapshotId,
      ),
      "lineage observations must use expected source snapshot",
    );

    logStep("asserting cron endpoint execution path");

    const cronRequest = new NextRequest(
      "http://localhost/api/cron/aquifer-forecast",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${process.env.CRON_SECRET}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          districtIds: [districtId],
          runKeyPrefix: cronPrefix,
        }),
      },
    );

    const cronResponse = await forecastCronRoute.POST(cronRequest);
    assert.equal(cronResponse.status, 200, "cron route should succeed");

    const cronPayload = (await cronResponse.json()) as {
      summary: string;
      results: Array<{ result: { status: string; replay: boolean } }>;
    };

    assert.ok(
      cronPayload.summary === "ok" || cronPayload.summary === "partial_failure",
      "cron summary must be ok or partial_failure",
    );
    assert.equal(cronPayload.results.length, 1);
    assert.equal(cronPayload.results[0]!.result.status, "completed");

    const cronReplayRequest = new NextRequest(
      "http://localhost/api/cron/aquifer-forecast",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${process.env.CRON_SECRET}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          districtIds: [districtId],
          runKeyPrefix: cronPrefix,
        }),
      },
    );

    const cronReplayResponse = await forecastCronRoute.POST(cronReplayRequest);
    assert.equal(cronReplayResponse.status, 200);

    const cronReplayPayload = (await cronReplayResponse.json()) as {
      results: Array<{ result: { replay: boolean } }>;
    };

    assert.equal(
      cronReplayPayload.results[0]!.result.replay,
      true,
      "cron replay request should return replay=true",
    );

    logStep("all forecast integration assertions passed");
  } finally {
    await cleanup();
  }
}

main()
  .then(() => {
    console.log("[forecast-integration] PASS");
  })
  .catch((error: unknown) => {
    console.error("[forecast-integration] FAIL", error);
    process.exitCode = 1;
  });
