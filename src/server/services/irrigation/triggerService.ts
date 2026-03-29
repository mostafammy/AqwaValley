import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "~/server/db";
import {
  farmWell,
  irrigationEvent,
  irrigationRecommendation,
  irrigationSimulationRun,
  wellValveState,
} from "~/server/db/schema";
import { HydrologyModelV1, IrrigationPhysicsEngine } from "./simulation";

type ActivationInput = {
  farmId: string;
  recommendationId: string;
  requestedByUserId: string;
  wellIds: string[];
  durationMinutes: number;
  planSource?: string;
  modelMode?: "production" | "demo";
};

type ActivationResult = {
  irrigationEventId: string;
  simulationRunId: string;
  status: "QUEUED";
  queueJobId: string;
};

type EventStatusResult = {
  irrigationEventId: string;
  status: string;
  startedAt: Date | null;
  endedAt: Date | null;
  quotaDebitStatus: string;
  quotaDebitAttempts: number;
  failureCode: string | null;
  failureMessage: string | null;
  simulationRun: {
    id: string;
    runStatus: string;
    engineVersion: string;
    hydrologyModelVersion: string;
    queueJobId: string | null;
    createdAt: Date;
    completedAt: Date | null;
  } | null;
};

type ListRecentResult = {
  id: string;
  status: string;
  durationMinutes: number;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  quotaDebitStatus: string;
};

function assertDurationMinutes(value: number): void {
  if (!Number.isInteger(value) || value <= 0 || value > 24 * 60) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "durationMinutes must be an integer in range [1, 1440].",
    });
  }
}

async function assertRecommendationBelongsToFarm(
  farmId: string,
  recommendationId: string,
): Promise<void> {
  const [record] = await db
    .select({ id: irrigationRecommendation.id })
    .from(irrigationRecommendation)
    .where(
      and(
        eq(irrigationRecommendation.id, recommendationId),
        eq(irrigationRecommendation.farmId, farmId),
      ),
    )
    .limit(1);

  if (!record) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Irrigation recommendation was not found for this farm.",
    });
  }
}

async function assertWellsBelongToFarm(
  farmId: string,
  wellIds: string[],
): Promise<void> {
  if (wellIds.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "At least one well is required.",
    });
  }

  const links = await db
    .select({ wellId: farmWell.wellId })
    .from(farmWell)
    .where(and(eq(farmWell.farmId, farmId), inArray(farmWell.wellId, wellIds)));

  if (links.length !== wellIds.length) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "One or more selected wells are not assigned to the farm.",
    });
  }
}

export async function startIrrigationActivation(
  input: ActivationInput,
): Promise<ActivationResult> {
  assertDurationMinutes(input.durationMinutes);
  await assertRecommendationBelongsToFarm(input.farmId, input.recommendationId);
  await assertWellsBelongToFarm(input.farmId, input.wellIds);

  const model = new HydrologyModelV1();
  const engine = new IrrigationPhysicsEngine(model);
  const now = new Date();
  const queueJobId = `irrigation:${input.farmId}:${now.getTime()}`;

  const [event] = await db
    .insert(irrigationEvent)
    .values({
      farmId: input.farmId,
      recommendationId: input.recommendationId,
      triggeredByUserId: input.requestedByUserId,
      wellIds: input.wellIds,
      status: "QUEUED",
      planSource: input.planSource ?? "recommendation",
      durationMinutes: input.durationMinutes,
      quotaDebitStatus: "PENDING",
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: irrigationEvent.id });

  if (!event) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create irrigation event.",
    });
  }

  const [simRun] = await db
    .insert(irrigationSimulationRun)
    .values({
      irrigationEventId: event.id,
      queueJobId,
      runStatus: "QUEUED",
      engineVersion: engine.engineVersion,
      hydrologyModelVersion: engine.hydrologyModelVersion,
      modelMode: input.modelMode ?? "production",
      startTimestamp: now,
      timezone: "UTC",
      createdAt: now,
    })
    .returning({ id: irrigationSimulationRun.id });

  if (!simRun) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create irrigation simulation run.",
    });
  }

  await db.insert(wellValveState).values(
    input.wellIds.map((wellId) => ({
      wellId,
      state: "OPENING" as const,
      irrigationEventId: event.id,
      reason: "Irrigation activation accepted and queued.",
      transitionedAt: now,
    })),
  );

  return {
    irrigationEventId: event.id,
    simulationRunId: simRun.id,
    status: "QUEUED",
    queueJobId,
  };
}

export async function getIrrigationEventStatus(
  farmId: string,
  irrigationEventId: string,
): Promise<EventStatusResult | null> {
  const [event] = await db
    .select({
      id: irrigationEvent.id,
      status: irrigationEvent.status,
      startedAt: irrigationEvent.startedAt,
      endedAt: irrigationEvent.endedAt,
      quotaDebitStatus: irrigationEvent.quotaDebitStatus,
      quotaDebitAttempts: irrigationEvent.quotaDebitAttempts,
      failureCode: irrigationEvent.failureCode,
      failureMessage: irrigationEvent.failureMessage,
    })
    .from(irrigationEvent)
    .where(
      and(
        eq(irrigationEvent.id, irrigationEventId),
        eq(irrigationEvent.farmId, farmId),
      ),
    )
    .limit(1);

  if (!event) {
    return null;
  }

  const [run] = await db
    .select({
      id: irrigationSimulationRun.id,
      runStatus: irrigationSimulationRun.runStatus,
      engineVersion: irrigationSimulationRun.engineVersion,
      hydrologyModelVersion: irrigationSimulationRun.hydrologyModelVersion,
      queueJobId: irrigationSimulationRun.queueJobId,
      createdAt: irrigationSimulationRun.createdAt,
      completedAt: irrigationSimulationRun.completedAt,
    })
    .from(irrigationSimulationRun)
    .where(eq(irrigationSimulationRun.irrigationEventId, event.id))
    .orderBy(desc(irrigationSimulationRun.createdAt))
    .limit(1);

  return {
    irrigationEventId: event.id,
    status: event.status,
    startedAt: event.startedAt,
    endedAt: event.endedAt,
    quotaDebitStatus: event.quotaDebitStatus,
    quotaDebitAttempts: event.quotaDebitAttempts,
    failureCode: event.failureCode,
    failureMessage: event.failureMessage,
    simulationRun: run
      ? {
          id: run.id,
          runStatus: run.runStatus,
          engineVersion: run.engineVersion,
          hydrologyModelVersion: run.hydrologyModelVersion,
          queueJobId: run.queueJobId,
          createdAt: run.createdAt,
          completedAt: run.completedAt,
        }
      : null,
  };
}

export async function cancelIrrigationActivation(params: {
  farmId: string;
  irrigationEventId: string;
  cancelledByUserId: string;
}): Promise<{ irrigationEventId: string; status: "CANCELLED" }> {
  const [event] = await db
    .select({
      id: irrigationEvent.id,
      status: irrigationEvent.status,
      wellIds: irrigationEvent.wellIds,
    })
    .from(irrigationEvent)
    .where(
      and(
        eq(irrigationEvent.id, params.irrigationEventId),
        eq(irrigationEvent.farmId, params.farmId),
      ),
    )
    .limit(1);

  if (!event) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Irrigation event not found.",
    });
  }

  if (["COMPLETED", "FAILED", "CANCELLED"].includes(event.status)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Irrigation event cannot be cancelled from status ${event.status}.`,
    });
  }

  const now = new Date();

  await db
    .update(irrigationEvent)
    .set({
      status: "CANCELLED",
      endedAt: now,
      updatedAt: now,
      failureCode: "CANCELLED_BY_USER",
      failureMessage: `Cancelled by user ${params.cancelledByUserId}.`,
    })
    .where(eq(irrigationEvent.id, event.id));

  await db
    .update(irrigationSimulationRun)
    .set({ runStatus: "CANCELLED", completedAt: now })
    .where(eq(irrigationSimulationRun.irrigationEventId, event.id));

  await db.insert(wellValveState).values(
    event.wellIds.map((wellId) => ({
      wellId,
      state: "CLOSING" as const,
      irrigationEventId: event.id,
      reason: "Cancellation requested by user.",
      transitionedAt: now,
    })),
  );

  await db.insert(wellValveState).values(
    event.wellIds.map((wellId) => ({
      wellId,
      state: "CLOSED" as const,
      irrigationEventId: event.id,
      reason: "Irrigation cancelled and valves closed.",
      transitionedAt: now,
    })),
  );

  return {
    irrigationEventId: event.id,
    status: "CANCELLED",
  };
}

export async function listRecentIrrigationEvents(params: {
  farmId: string;
  limit: number;
  offset: number;
}): Promise<ListRecentResult[]> {
  return db
    .select({
      id: irrigationEvent.id,
      status: irrigationEvent.status,
      durationMinutes: irrigationEvent.durationMinutes,
      createdAt: irrigationEvent.createdAt,
      startedAt: irrigationEvent.startedAt,
      endedAt: irrigationEvent.endedAt,
      quotaDebitStatus: irrigationEvent.quotaDebitStatus,
    })
    .from(irrigationEvent)
    .where(eq(irrigationEvent.farmId, params.farmId))
    .orderBy(desc(irrigationEvent.createdAt))
    .limit(params.limit)
    .offset(params.offset);
}
