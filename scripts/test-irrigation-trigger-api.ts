/**
 * Irrigation Trigger API Integration Suite
 *
 * Covers protected tRPC irrigation endpoints used by frontend trigger workflows.
 *
 * Usage:
 *   pnpm test:irrigation-api
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { eq, inArray } from "drizzle-orm";

type TestFn = () => Promise<void>;
type AsyncCall = () => Promise<unknown>;

type TestCase = {
  name: string;
  run: TestFn;
};

function loadEnvFiles(): void {
  const envFiles = [".env.local", ".env"];

  for (const file of envFiles) {
    if (!existsSync(file)) continue;

    const content = readFileSync(file, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;

      const key = trimmed.slice(0, idx).trim();
      const rawValue = trimmed.slice(idx + 1).trim();
      const value = rawValue.replace(/^['"]|['"]$/g, "");

      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  }
}

function printHeader(title: string): void {
  console.log("\n" + "=".repeat(76));
  console.log(`  ${title}`);
  console.log("=".repeat(76));
}

function printPass(message: string): void {
  console.log(`  PASS  ${message}`);
}

function printFail(message: string): void {
  console.log(`  FAIL  ${message}`);
}

async function shutdownAndExit(code: number): Promise<never> {
  // Allow stdout/stderr to flush before terminating, then force process exit.
  await new Promise((resolve) => setTimeout(resolve, 20));
  process.exit(code);
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = error as { code?: unknown; data?: { code?: unknown } };

  if (typeof candidate.code === "string") return candidate.code;
  if (typeof candidate.data?.code === "string") return candidate.data.code;
  return undefined;
}

async function expectTrpcCode(
  fn: AsyncCall,
  expectedCode: string,
): Promise<void> {
  try {
    await fn();
    assert.fail(`Expected tRPC error code ${expectedCode} but call succeeded.`);
  } catch (error) {
    const code = getErrorCode(error);
    assert.equal(
      code,
      expectedCode,
      `Expected tRPC error code ${expectedCode} but got ${String(code)}.`,
    );
  }
}

loadEnvFiles();

async function main(): Promise<void> {
  const { db } = await import("~/server/db");
  const schema = await import("~/server/db/schema");
  const { irrigationRouter } = await import("~/server/api/routers/irrigation");

  const createdRecommendationIds: string[] = [];
  const createdEventIds: string[] = [];

  printHeader("Irrigation Trigger API Integration Suite");

  const [userRecord] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .limit(1);

  if (!userRecord) {
    throw new Error("No user found in database. Seed at least one user first.");
  }
  const actorUserId = userRecord.id;

  const [farmWithWell] = await db
    .select({
      farmId: schema.farm.id,
      ownerId: schema.farm.ownerId,
      farmerUserId: schema.farm.farmerUserId,
      wellId: schema.farmWell.wellId,
    })
    .from(schema.farm)
    .innerJoin(schema.farmWell, eq(schema.farm.id, schema.farmWell.farmId))
    .limit(1);

  if (!farmWithWell) {
    throw new Error(
      "No farm with linked wells found. Ensure farm and farm_well test data exists.",
    );
  }

  const farmId = farmWithWell.farmId;
  const wellId = farmWithWell.wellId;

  const authorizedCaller = irrigationRouter.createCaller({
    db,
    headers: new Headers(),
    session: { user: { id: actorUserId } },
    userRoles: ["admin"],
  } as never);

  const unauthorizedCaller = irrigationRouter.createCaller({
    db,
    headers: new Headers(),
    session: null,
    userRoles: [],
  } as never);

  async function createRecommendationForFarm(): Promise<string> {
    const [row] = await db
      .insert(schema.irrigationRecommendation)
      .values({
        farmId,
        requestedBy: actorUserId,
        systemPrompt: "integration-test-system-prompt",
        userMessage: "integration-test-user-message",
        rawResponse: '{"source":"integration-test"}',
        plan: {
          summary: "Integration test plan",
          wells: [wellId],
          durationMinutes: 30,
        },
        totalLitres: 1200,
        modelUsed: "integration-test-model",
        fallback: true,
        status: "PENDING",
      })
      .returning({ id: schema.irrigationRecommendation.id });

    assert.ok(row, "Failed to create test recommendation.");
    createdRecommendationIds.push(row.id);
    return row.id;
  }

  let activationEventId: string | null = null;

  const tests: TestCase[] = [
    {
      name: "Unauthorized calls are blocked",
      run: async () => {
        await expectTrpcCode(async () => {
          await unauthorizedCaller.listRecentIrrigations({
            farmId,
            limit: 5,
            offset: 0,
          });
        }, "UNAUTHORIZED");
      },
    },
    {
      name: "activateRecommendation creates queued event and run",
      run: async () => {
        const recommendationId = await createRecommendationForFarm();

        const result = await authorizedCaller.activateRecommendation({
          farmId,
          recommendationId,
          wellIds: [wellId],
          durationMinutes: 30,
          planSource: "integration-suite",
          modelMode: "production",
        });

        assert.equal(result.status, "QUEUED");
        assert.ok(result.irrigationEventId);
        assert.ok(result.simulationRunId);
        assert.ok(result.queueJobId);

        activationEventId = result.irrigationEventId;
        createdEventIds.push(result.irrigationEventId);

        const [eventRow] = await db
          .select({
            id: schema.irrigationEvent.id,
            status: schema.irrigationEvent.status,
          })
          .from(schema.irrigationEvent)
          .where(eq(schema.irrigationEvent.id, result.irrigationEventId))
          .limit(1);

        assert.ok(eventRow, "Irrigation event row was not created.");
        assert.equal(eventRow.status, "QUEUED");
      },
    },
    {
      name: "getIrrigationStatus returns event + simulation run snapshot",
      run: async () => {
        assert.ok(
          activationEventId,
          "Activation event is missing from previous test.",
        );

        const status = await authorizedCaller.getIrrigationStatus({
          farmId,
          irrigationEventId: activationEventId,
        });

        assert.equal(status.irrigationEventId, activationEventId);
        assert.ok(
          status.simulationRun,
          "Expected simulationRun payload in status response.",
        );
      },
    },
    {
      name: "listRecentIrrigations includes newly created event",
      run: async () => {
        assert.ok(
          activationEventId,
          "Activation event is missing from previous test.",
        );

        const list = await authorizedCaller.listRecentIrrigations({
          farmId,
          limit: 10,
          offset: 0,
        });

        const hasEvent = list.some((item) => item.id === activationEventId);
        assert.equal(
          hasEvent,
          true,
          "Expected recent list to contain the new event.",
        );
      },
    },
    {
      name: "cancelIrrigation moves event to CANCELLED",
      run: async () => {
        assert.ok(
          activationEventId,
          "Activation event is missing from previous test.",
        );

        const cancel = await authorizedCaller.cancelIrrigation({
          farmId,
          irrigationEventId: activationEventId,
        });

        assert.equal(cancel.status, "CANCELLED");

        const status = await authorizedCaller.getIrrigationStatus({
          farmId,
          irrigationEventId: activationEventId,
        });

        assert.equal(status.status, "CANCELLED");
      },
    },
    {
      name: "getLatestPlan returns latest recommendation for farm",
      run: async () => {
        const latest = await authorizedCaller.getLatestPlan({ farmId });
        assert.ok(latest, "Expected getLatestPlan to return a recommendation.");
        assert.equal(latest.farmId, farmId);
      },
    },
    {
      name: "listPlans returns paginated recommendation history",
      run: async () => {
        const plans = await authorizedCaller.listPlans({
          farmId,
          limit: 5,
          offset: 0,
        });

        assert.ok(
          plans.length > 0,
          "Expected at least one recommendation in listPlans.",
        );
        assert.equal(plans[0]?.farmId, farmId);
      },
    },
    {
      name: "replaySimulationRun rejects unknown run id",
      run: async () => {
        await expectTrpcCode(async () => {
          await authorizedCaller.replaySimulationRun({ runId: randomUUID() });
        }, "NOT_FOUND");
      },
    },
    {
      name: "diffSimulationRuns rejects unknown run ids",
      run: async () => {
        await expectTrpcCode(async () => {
          await authorizedCaller.diffSimulationRuns({
            baseRunId: randomUUID(),
            candidateRunId: randomUUID(),
          });
        }, "NOT_FOUND");
      },
    },
  ];

  let failed = 0;

  for (const test of tests) {
    try {
      await test.run();
      printPass(test.name);
    } catch (error) {
      failed += 1;
      printFail(test.name);
      console.error(error);
    }
  }

  printHeader("Cleanup");
  try {
    if (createdEventIds.length > 0) {
      await db
        .delete(schema.irrigationEvent)
        .where(inArray(schema.irrigationEvent.id, createdEventIds));
    }

    if (createdRecommendationIds.length > 0) {
      await db
        .delete(schema.irrigationRecommendation)
        .where(
          inArray(schema.irrigationRecommendation.id, createdRecommendationIds),
        );
    }

    printPass("Removed test events and recommendations.");
  } catch (cleanupError) {
    failed += 1;
    printFail("Cleanup encountered an error.");
    console.error(cleanupError);
  }

  printHeader("Suite Result");
  if (failed > 0) {
    console.error(`  ${failed} test(s) failed.`);
    await shutdownAndExit(1);
  }

  console.log("  All irrigation trigger API integration tests passed.");
  await shutdownAndExit(0);
}

main().catch((error) => {
  console.error("Unexpected suite failure", error);
  process.exit(1);
});
