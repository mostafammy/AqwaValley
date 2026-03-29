import { and, asc, desc, eq, inArray, not } from "drizzle-orm";

import { logger } from "~/lib/logger";
import { db } from "~/server/db";
import {
  farm,
  irrigationEvent,
  irrigationSimulationRun,
  sensors,
  well,
  wellValveState,
} from "~/server/db/schema";
import { simulateIrrigationRun } from "./simulateIrrigationRun";
import {
  assertIrrigationTransition,
  type IrrigationEventStatus,
} from "./simulation";
import { resolveProviderInputsForRun } from "./providerResolver";
import { canonicalJsonString, hashCanonical } from "./simulationHashing";
import { writeSimulationReadings } from "./shadowIngestService";
import { computeRunOutputHash } from "./runOutputHash";
import { evaluateAndPersistRunDiff } from "./runDiffService";

const SHADOW_GENERATOR_VERSION = "irrigation_shadow_ingest_v1.0.0";
const PRICING_SNAPSHOT_VERSION = "pricing_v1_static_2026_03";

type WorkerSummary = {
  scanned: number;
  started: number;
  completed: number;
  failed: number;
  cancelled: number;
};

type QueuedRunRecord = {
  irrigationEventId: string;
  simulationRunId: string;
  runCreatedAt: Date;
};

async function loadExecutionStatuses(params: {
  irrigationEventId: string;
  simulationRunId: string;
}): Promise<{
  eventStatus: string | null;
  runStatus: string | null;
}> {
  const [eventRow] = await db
    .select({ status: irrigationEvent.status })
    .from(irrigationEvent)
    .where(eq(irrigationEvent.id, params.irrigationEventId))
    .limit(1);

  const [runRow] = await db
    .select({ runStatus: irrigationSimulationRun.runStatus })
    .from(irrigationSimulationRun)
    .where(eq(irrigationSimulationRun.id, params.simulationRunId))
    .limit(1);

  return {
    eventStatus: eventRow?.status ?? null,
    runStatus: runRow?.runStatus ?? null,
  };
}

function isCancelledState(params: {
  eventStatus: string | null;
  runStatus: string | null;
}): boolean {
  return params.eventStatus === "CANCELLED" || params.runStatus === "CANCELLED";
}

function transitionOrThrow(
  from: IrrigationEventStatus,
  to: IrrigationEventStatus,
): void {
  assertIrrigationTransition(from, to);
}

function toFinite(value: string | null): number {
  const parsed = value ? Number.parseFloat(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function getSensorValue(params: {
  sensorType: (typeof sensors.$inferSelect)["type"];
  elapsedSeconds: number;
  waterLevelM: number;
  flowM3Hr: number;
}): number {
  switch (params.sensorType) {
    case "water_level":
      return params.waterLevelM;
    case "flow_rate":
      return params.flowM3Hr;
    case "pressure": {
      const modulation = Math.sin(params.elapsedSeconds / 180) * 0.1;
      return Math.max(0, 2 + modulation);
    }
    case "temperature": {
      const modulation = Math.sin(params.elapsedSeconds / 3600) * 1.5;
      return 28 + modulation;
    }
    case "humidity": {
      const modulation = Math.cos(params.elapsedSeconds / 4200) * 4;
      return Math.max(0, Math.min(100, 52 + modulation));
    }
    default:
      return 0;
  }
}

async function completeWithFailure(params: {
  irrigationEventId: string;
  simulationRunId: string;
  failureCode: string;
  failureMessage: string;
}): Promise<void> {
  const now = new Date();

  const statuses = await loadExecutionStatuses({
    irrigationEventId: params.irrigationEventId,
    simulationRunId: params.simulationRunId,
  });

  // Do not overwrite late cancellation with FAILED.
  if (isCancelledState(statuses)) {
    await db
      .update(irrigationSimulationRun)
      .set({ runStatus: "CANCELLED", completedAt: now })
      .where(
        and(
          eq(irrigationSimulationRun.id, params.simulationRunId),
          not(eq(irrigationSimulationRun.runStatus, "CANCELLED")),
        ),
      );
    return;
  }

  const [event] = await db
    .select({ wellIds: irrigationEvent.wellIds })
    .from(irrigationEvent)
    .where(eq(irrigationEvent.id, params.irrigationEventId))
    .limit(1);

  await db
    .update(irrigationEvent)
    .set({
      status: "FAILED",
      endedAt: now,
      updatedAt: now,
      failureCode: params.failureCode,
      failureMessage: params.failureMessage,
      quotaDebitStatus: "FAILED",
    })
    .where(eq(irrigationEvent.id, params.irrigationEventId));

  await db
    .update(irrigationSimulationRun)
    .set({
      runStatus: "FAILED",
      completedAt: now,
    })
    .where(eq(irrigationSimulationRun.id, params.simulationRunId));

  if (event && event.wellIds.length > 0) {
    await db.insert(wellValveState).values(
      event.wellIds.map((wellId) => ({
        wellId,
        state: "CLOSING" as const,
        irrigationEventId: params.irrigationEventId,
        reason: `Run failed (${params.failureCode}), closing valves.`,
        transitionedAt: now,
      })),
    );

    await db.insert(wellValveState).values(
      event.wellIds.map((wellId) => ({
        wellId,
        state: "CLOSED" as const,
        irrigationEventId: params.irrigationEventId,
        reason: `Run failed (${params.failureCode}), valves closed.`,
        transitionedAt: now,
      })),
    );
  }
}

async function processQueuedRun(
  queued: QueuedRunRecord,
): Promise<"completed" | "failed" | "cancelled"> {
  const [eventRecord] = await db
    .select({
      id: irrigationEvent.id,
      farmId: irrigationEvent.farmId,
      wellIds: irrigationEvent.wellIds,
      durationMinutes: irrigationEvent.durationMinutes,
      status: irrigationEvent.status,
    })
    .from(irrigationEvent)
    .where(eq(irrigationEvent.id, queued.irrigationEventId))
    .limit(1);

  if (!eventRecord) {
    await completeWithFailure({
      irrigationEventId: queued.irrigationEventId,
      simulationRunId: queued.simulationRunId,
      failureCode: "MISSING_EVENT",
      failureMessage: "Irrigation event disappeared before worker execution.",
    });
    return "failed";
  }

  if (eventRecord.status === "CANCELLED") {
    await db
      .update(irrigationSimulationRun)
      .set({ runStatus: "CANCELLED", completedAt: new Date() })
      .where(eq(irrigationSimulationRun.id, queued.simulationRunId));
    return "cancelled";
  }

  const preRunStatuses = await loadExecutionStatuses({
    irrigationEventId: eventRecord.id,
    simulationRunId: queued.simulationRunId,
  });

  if (isCancelledState(preRunStatuses)) {
    await db
      .update(irrigationSimulationRun)
      .set({ runStatus: "CANCELLED", completedAt: new Date() })
      .where(eq(irrigationSimulationRun.id, queued.simulationRunId));
    return "cancelled";
  }

  if (!preRunStatuses.eventStatus) {
    await completeWithFailure({
      irrigationEventId: eventRecord.id,
      simulationRunId: queued.simulationRunId,
      failureCode: "MISSING_EVENT",
      failureMessage: "Irrigation event disappeared before RUNNING transition.",
    });
    return "failed";
  }

  transitionOrThrow(preRunStatuses.eventStatus as IrrigationEventStatus, "RUNNING");

  const now = new Date();
  await db
    .update(irrigationEvent)
    .set({
      status: "RUNNING",
      startedAt: now,
      updatedAt: now,
      failureCode: null,
      failureMessage: null,
    })
    .where(
      and(
        eq(irrigationEvent.id, eventRecord.id),
        not(eq(irrigationEvent.status, "CANCELLED")),
      ),
    );

  await db
    .update(irrigationSimulationRun)
    .set({ runStatus: "RUNNING" })
    .where(
      and(
        eq(irrigationSimulationRun.id, queued.simulationRunId),
        not(eq(irrigationSimulationRun.runStatus, "CANCELLED")),
      ),
    );

  const postRunningStatuses = await loadExecutionStatuses({
    irrigationEventId: eventRecord.id,
    simulationRunId: queued.simulationRunId,
  });

  if (isCancelledState(postRunningStatuses)) {
    await db
      .update(irrigationSimulationRun)
      .set({ runStatus: "CANCELLED", completedAt: now })
      .where(eq(irrigationSimulationRun.id, queued.simulationRunId));
    return "cancelled";
  }

  await db.insert(wellValveState).values(
    eventRecord.wellIds.map((wellId) => ({
      wellId,
      state: "OPEN" as const,
      irrigationEventId: eventRecord.id,
      reason: "Worker started execution.",
      transitionedAt: now,
    })),
  );

  const [farmRecord] = await db
    .select({
      totalAreaAcres: farm.totalAreaAcres,
      districtId: farm.districtId,
    })
    .from(farm)
    .where(eq(farm.id, eventRecord.farmId))
    .limit(1);

  const wellRecords = await db
    .select({
      id: well.id,
      baselineFlowRateM3Hr: well.baselineFlowRateM3Hr,
      maxFlowRateM3Hr: well.maxFlowRateM3Hr,
    })
    .from(well)
    .where(inArray(well.id, eventRecord.wellIds));

  const sensorRecords = await db
    .select({
      id: sensors.id,
      wellId: sensors.wellId,
      type: sensors.type,
      unit: sensors.unit,
      isActive: sensors.isActive,
    })
    .from(sensors)
    .where(
      and(
        inArray(sensors.wellId, eventRecord.wellIds),
        eq(sensors.isActive, true),
      ),
    );

  if (sensorRecords.length === 0) {
    await completeWithFailure({
      irrigationEventId: eventRecord.id,
      simulationRunId: queued.simulationRunId,
      failureCode: "NO_ACTIVE_SENSORS",
      failureMessage: "No active sensors available for the selected wells.",
    });
    return "failed";
  }

  const areaM2 = Math.max(
    1000,
    toFinite(farmRecord?.totalAreaAcres ?? null) * 4046.85642,
  );

  if (!farmRecord) {
    await completeWithFailure({
      irrigationEventId: eventRecord.id,
      simulationRunId: queued.simulationRunId,
      failureCode: "MISSING_FARM",
      failureMessage:
        "Farm record not found while processing irrigation event.",
    });
    return "failed";
  }

  const providerInputs = await resolveProviderInputsForRun({
    farmId: eventRecord.farmId,
    districtId: farmRecord.districtId,
    at: now,
  });

  if (!providerInputs.ok) {
    await completeWithFailure({
      irrigationEventId: eventRecord.id,
      simulationRunId: queued.simulationRunId,
      failureCode: providerInputs.error.code,
      failureMessage: providerInputs.error.message,
    });
    return "failed";
  }

  const totalBaselineFlowM3Hr = Math.max(
    1,
    wellRecords.reduce((sum, item) => {
      const baseline = toFinite(item.baselineFlowRateM3Hr);
      const maxFlow = toFinite(item.maxFlowRateM3Hr);
      return sum + Math.max(baseline, maxFlow > 0 ? maxFlow * 0.7 : 0);
    }, 0),
  );

  const inputEnvelope = {
    farmId: eventRecord.farmId,
    irrigationEventId: eventRecord.id,
    wellIds: [...eventRecord.wellIds].sort(),
    durationMinutes: eventRecord.durationMinutes,
    areaM2,
    startTimestamp: now.toISOString(),
    baseFlowRateM3s: totalBaselineFlowM3Hr / 3600,
  };

  const providerSnapshotHash = hashCanonical(
    providerInputs.value.providerSnapshot,
  );
  const inputHash = hashCanonical(inputEnvelope);

  await db
    .update(irrigationSimulationRun)
    .set({
      inputHash,
      inputEnvelopeJson: JSON.parse(
        canonicalJsonString(inputEnvelope),
      ) as Record<string, unknown>,
      providerSnapshotHash,
      providerSnapshotJson: JSON.parse(
        canonicalJsonString(providerInputs.value.providerSnapshot),
      ) as Record<string, unknown>,
      adapterUnitVersion: providerInputs.value.adapterUnitVersion,
      pricingSnapshotVersion: PRICING_SNAPSHOT_VERSION,
    })
    .where(eq(irrigationSimulationRun.id, queued.simulationRunId));

  const cancellationToken = { cancelled: false };

  const runResult = simulateIrrigationRun({
    startTimestamp: now,
    horizonSeconds: eventRecord.durationMinutes * 60,
    areaM2,
    initialWaterLevelM: 1,
    initialWaterDebtM3: 0,
    getHydrologyInputsAt: ({ elapsedSeconds }) => ({
      et0DepthRateMps: providerInputs.value.et0DepthRateMps,
      kc: providerInputs.value.kc,
      stressCoefficient: providerInputs.value.stressCoefficient,
      drainageCoefficientPerSecond:
        providerInputs.value.drainageCoefficientPerSecond,
      fieldCapacityDepthM: providerInputs.value.fieldCapacityDepthM,
      valveOpen: true,
      inflowMode: "pressure_aware",
      baseFlowRateM3s: totalBaselineFlowM3Hr / 3600,
      pressurePa: 200_000 + Math.sin(elapsedSeconds / 300) * 10_000,
      nominalPressurePa: 200_000,
      maxPressureMultiplier: 1.2,
    }),
    shouldCancel: () => cancellationToken.cancelled,
  });

  if (!runResult.ok) {
    await completeWithFailure({
      irrigationEventId: eventRecord.id,
      simulationRunId: queued.simulationRunId,
      failureCode: runResult.error.code,
      failureMessage: runResult.error.message,
    });
    return "failed";
  }

  const readings = runResult.value.samples.flatMap((sample) =>
    sensorRecords.map((sensor) => ({
      sensorId: sensor.id,
      value: getSensorValue({
        sensorType: sensor.type,
        elapsedSeconds: Number(sample.elapsedSeconds),
        waterLevelM: Number(sample.waterLevelM),
        flowM3Hr: totalBaselineFlowM3Hr,
      }),
      timestamp: sample.timestamp,
    })),
  );

  await writeSimulationReadings({
    simulationRunId: queued.simulationRunId,
    irrigationEventId: eventRecord.id,
    generatorVersion: SHADOW_GENERATOR_VERSION,
    readings,
    chunkSize: 500,
  });

  const endedAt = new Date();
  const actualConsumptionM3 =
    (totalBaselineFlowM3Hr * Math.max(1, eventRecord.durationMinutes)) / 60;
  const queueWaitTimeMs = Math.max(
    0,
    now.getTime() - queued.runCreatedAt.getTime(),
  );
  const executionTimeMs = Math.max(0, endedAt.getTime() - now.getTime());

  const trajectoryHash = computeRunOutputHash(runResult.value);

  const summaryDigestInput = {
    status: runResult.value.status,
    integrationStepCount: runResult.value.integrationStepCount,
    retryCount: runResult.value.retryCount,
    errorNormMax: runResult.value.errorNormMax,
    errorNormP95: runResult.value.errorNormP95,
    numericalDivergenceCount: runResult.value.numericalDivergenceCount,
    massDebtPeakM3: Number(runResult.value.massDebtPeakM3),
    debtEventCount: runResult.value.debtEventCount,
    sampleCount: runResult.value.samples.length,
    readingCount: readings.length,
  };
  const summaryHash = hashCanonical(summaryDigestInput);

  const costComputeUsd = Number(
    (runResult.value.integrationStepCount * 0.0000025).toFixed(6),
  );
  const costStorageUsd = Number((readings.length * 0.0000001).toFixed(6));
  const costQueueUsd = 0.0001;
  const costExternalApiUsd = 0;
  const runCostUsd = Number(
    (
      costComputeUsd +
      costStorageUsd +
      costQueueUsd +
      costExternalApiUsd
    ).toFixed(6),
  );

  const costBreakdown = {
    cost_compute_usd: costComputeUsd,
    cost_storage_usd: costStorageUsd,
    cost_queue_usd: costQueueUsd,
    cost_external_api_usd: costExternalApiUsd,
    pricing_snapshot_version: PRICING_SNAPSHOT_VERSION,
  };

  const preCompleteStatuses = await loadExecutionStatuses({
    irrigationEventId: eventRecord.id,
    simulationRunId: queued.simulationRunId,
  });

  if (isCancelledState(preCompleteStatuses)) {
    await db
      .update(irrigationSimulationRun)
      .set({ runStatus: "CANCELLED", completedAt: endedAt })
      .where(eq(irrigationSimulationRun.id, queued.simulationRunId));
    return "cancelled";
  }

  if (!preCompleteStatuses.eventStatus) {
    await completeWithFailure({
      irrigationEventId: eventRecord.id,
      simulationRunId: queued.simulationRunId,
      failureCode: "MISSING_EVENT",
      failureMessage: "Irrigation event disappeared before COMPLETED transition.",
    });
    return "failed";
  }

  transitionOrThrow(preCompleteStatuses.eventStatus as IrrigationEventStatus, "COMPLETED");

  await db
    .update(irrigationEvent)
    .set({
      status: "COMPLETED",
      endedAt,
      updatedAt: endedAt,
      actualConsumptionM3: actualConsumptionM3.toFixed(4),
      quotaDebitM3: actualConsumptionM3.toFixed(4),
      quotaDebitStatus: "APPLIED",
      quotaDebitAttempts: 1,
    })
    .where(
      and(
        eq(irrigationEvent.id, eventRecord.id),
        not(eq(irrigationEvent.status, "CANCELLED")),
      ),
    );

  await db
    .update(irrigationSimulationRun)
    .set({
      runStatus: "COMPLETED",
      integrationStepCount: runResult.value.integrationStepCount,
      retryCount: runResult.value.retryCount,
      dtMinObservedS: Number(runResult.value.dtMinObservedS).toFixed(4),
      dtMaxObservedS: Number(runResult.value.dtMaxObservedS).toFixed(4),
      errorNormMax: runResult.value.errorNormMax,
      errorNormP95: runResult.value.errorNormP95,
      numericalDivergenceCount: runResult.value.numericalDivergenceCount,
      massDebtPeakM3: Number(runResult.value.massDebtPeakM3).toFixed(4),
      debtEventCount: runResult.value.debtEventCount,
      trajectoryHash,
      summaryHash,
      phaseStepCountsJson: {
        total: runResult.value.integrationStepCount,
      },
      qualityStateCountsJson: {
        VALID: runResult.value.samples.length,
        DEGRADED: 0,
        INVALID: 0,
      },
      anomalyCodeCountsJson: {},
      queueWaitTimeMs,
      executionTimeMs,
      runCostUsd: runCostUsd.toFixed(6),
      runCostBreakdownJson: JSON.parse(
        canonicalJsonString(costBreakdown),
      ) as Record<string, unknown>,
      completedAt: endedAt,
    })
    .where(
      and(
        eq(irrigationSimulationRun.id, queued.simulationRunId),
        not(eq(irrigationSimulationRun.runStatus, "CANCELLED")),
      ),
    );

  const [baseRun] = await db
    .select({ id: irrigationSimulationRun.id })
    .from(irrigationSimulationRun)
    .innerJoin(
      irrigationEvent,
      eq(irrigationSimulationRun.irrigationEventId, irrigationEvent.id),
    )
    .where(
      and(
        eq(irrigationEvent.farmId, eventRecord.farmId),
        eq(irrigationSimulationRun.runStatus, "COMPLETED"),
        not(eq(irrigationSimulationRun.id, queued.simulationRunId)),
      ),
    )
    .orderBy(
      desc(irrigationSimulationRun.completedAt),
      desc(irrigationSimulationRun.createdAt),
    )
    .limit(1);

  if (baseRun) {
    const diffResult = await evaluateAndPersistRunDiff({
      baseRunId: baseRun.id,
      candidateRunId: queued.simulationRunId,
    });

    if (!diffResult.ok) {
      logger.warn(
        {
          baseRunId: baseRun.id,
          candidateRunId: queued.simulationRunId,
          error: diffResult.error,
        },
        "irrigation.worker.run_diff_failed",
      );
    }
  }

  await db.insert(wellValveState).values(
    eventRecord.wellIds.map((wellId) => ({
      wellId,
      state: "CLOSING" as const,
      irrigationEventId: eventRecord.id,
      reason: "Run completed, closing valves.",
      transitionedAt: endedAt,
    })),
  );

  await db.insert(wellValveState).values(
    eventRecord.wellIds.map((wellId) => ({
      wellId,
      state: "CLOSED" as const,
      irrigationEventId: eventRecord.id,
      reason: "Run completed and valves closed.",
      transitionedAt: endedAt,
    })),
  );

  logger.info(
    {
      irrigationEventId: eventRecord.id,
      simulationRunId: queued.simulationRunId,
      sampleCount: runResult.value.samples.length,
      readingCount: readings.length,
      districtId: farmRecord?.districtId,
    },
    "irrigation.worker.completed",
  );

  return "completed";
}

export async function processQueuedIrrigationEvents(
  limit = 10,
): Promise<WorkerSummary> {
  const queued = await db
    .select({
      irrigationEventId: irrigationEvent.id,
      simulationRunId: irrigationSimulationRun.id,
      runCreatedAt: irrigationSimulationRun.createdAt,
    })
    .from(irrigationEvent)
    .innerJoin(
      irrigationSimulationRun,
      eq(irrigationSimulationRun.irrigationEventId, irrigationEvent.id),
    )
    .where(
      and(
        eq(irrigationEvent.status, "QUEUED"),
        eq(irrigationSimulationRun.runStatus, "QUEUED"),
      ),
    )
    .orderBy(asc(irrigationEvent.createdAt))
    .limit(Math.max(1, limit));

  const summary: WorkerSummary = {
    scanned: queued.length,
    started: queued.length,
    completed: 0,
    failed: 0,
    cancelled: 0,
  };

  for (const item of queued) {
    try {
      const result = await processQueuedRun(item);
      if (result === "completed") summary.completed += 1;
      if (result === "failed") summary.failed += 1;
      if (result === "cancelled") summary.cancelled += 1;
    } catch (error) {
      summary.failed += 1;
      logger.error(
        {
          irrigationEventId: item.irrigationEventId,
          simulationRunId: item.simulationRunId,
          error,
        },
        "irrigation.worker.unhandled_error",
      );

      await completeWithFailure({
        irrigationEventId: item.irrigationEventId,
        simulationRunId: item.simulationRunId,
        failureCode: "WORKER_UNHANDLED_ERROR",
        failureMessage:
          error instanceof Error
            ? error.message
            : "Unhandled worker execution error.",
      });
    }
  }

  return summary;
}
