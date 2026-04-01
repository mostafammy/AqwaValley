/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { inArray, sql } from "drizzle-orm";

type TestResult = {
  reportJobId: string;
  reportArtifactId: string;
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
      const value = rawValue.replace(/^['\"]|['\"]$/g, "");

      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  }
}

function logStep(message: string): void {
  console.log(`[reporting-integration] ${message}`);
}

async function main(): Promise<void> {
  loadEnvFiles();
  process.env.CRON_SECRET ??= "reporting-integration-cron-secret";

  const { db } = await import("~/server/db");
  const schema = await import("~/server/db/schema");
  const { reportsRouter } = await import("~/server/api/routers/reports");
  const cronRoute = await import("~/app/api/cron/process-report-jobs/route");
  const downloadRoute =
    await import("~/app/api/reports/download/[artifactId]/route");

  const [userRecord] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .limit(1);

  if (!userRecord) {
    throw new Error("No user found in database. Seed at least one user first.");
  }

  const tableCheck = await db.execute(sql`
    select exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'report_job'
    ) as "exists"
  `);

  const firstRow = Array.isArray(tableCheck)
    ? (tableCheck[0] as { exists?: boolean } | undefined)
    : ((tableCheck as { rows?: Array<{ exists?: boolean }> }).rows?.[0] ??
      undefined);

  const reportsTableExists = firstRow?.exists === true;
  if (!reportsTableExists) {
    throw new Error(
      "Reporting tables are missing. Run migrations (including drizzle/0011_reporting_engine_foundation.sql) before running this test.",
    );
  }

  const caller = reportsRouter.createCaller({
    db,
    headers: new Headers(),
    session: { user: { id: userRecord.id } },
    userRoles: ["admin"],
  } as never);

  const createdJobIds: string[] = [];

  try {
    logStep("Requesting report generation job");

    const requested = await caller.requestGeneration({
      reportType: "user_activity",
      formats: ["pdf", "csv", "xlsx"],
      generationMode: "strict",
      granularity: "daily",
      scope: { scopeType: "global" },
      parameterSchemaVersion: "report-params-v1",
      templateVersion: "v1",
      policyVersion: "policy-current",
      maskingRulesVersion: "masking-current",
      snapshotId: `itest-${Date.now()}-${randomUUID().slice(0, 8)}`,
      snapshotType: "logical",
      snapshotMetadata: {
        trigger: "integration-test",
      },
      parameters: {
        scenario: "reporting-integration",
      },
    });

    assert.ok(requested.reportJobId, "Expected reportJobId");
    createdJobIds.push(requested.reportJobId);

    logStep("Processing queue through tRPC admin endpoint");

    const processResult = await caller.processQueue({ maxJobs: 10 });
    assert.ok(
      processResult.scanned >= 1,
      "Expected at least one scanned report job",
    );
    assert.ok(
      processResult.completed >= 1,
      "Expected at least one completed report job",
    );

    const result = await caller.getJob({ reportJobId: requested.reportJobId });
    assert.equal(
      result.job.status,
      "completed",
      "Expected job to be completed",
    );
    assert.ok(result.artifacts.length >= 1, "Expected at least one artifact");

    const firstArtifact = result.artifacts[0];
    if (!firstArtifact) {
      throw new Error("Expected at least one generated artifact");
    }

    const testResult: TestResult = {
      reportJobId: requested.reportJobId,
      reportArtifactId: firstArtifact.id,
    };

    logStep("Resolving secure download link");
    const link = await caller.getDownloadLink({
      reportArtifactId: testResult.reportArtifactId,
    });
    assert.ok(link.signedUrl.startsWith("/api/reports/download/"));

    logStep("Validating download route rejects unauthenticated access");
    const unauthorizedDownloadResponse = await downloadRoute.GET(
      new Request(`http://localhost:3000${link.signedUrl}`),
      { params: Promise.resolve({ artifactId: testResult.reportArtifactId }) },
    );
    assert.equal(unauthorizedDownloadResponse.status, 401);

    logStep("Validating cron route rejects missing secret");
    const badCronResponse = await cronRoute.POST(
      new Request("http://localhost:3000/api/cron/process-report-jobs", {
        method: "POST",
      }),
    );
    assert.equal(badCronResponse.status, 401);

    logStep("Validating cron route succeeds with valid secret");
    const goodCronResponse = await cronRoute.POST(
      new Request("http://localhost:3000/api/cron/process-report-jobs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cron-secret": process.env.CRON_SECRET ?? "",
        },
        body: JSON.stringify({ maxJobs: 10 }),
      }),
    );

    assert.equal(goodCronResponse.status, 200);
    const goodCronBody = (await goodCronResponse.json()) as { ok?: boolean };
    assert.equal(goodCronBody.ok, true);

    logStep("Reporting integration suite completed successfully");
  } finally {
    if (createdJobIds.length > 0) {
      await db
        .delete(schema.reportAuditLog)
        .where(inArray(schema.reportAuditLog.reportJobId, createdJobIds));

      await db
        .delete(schema.reportArtifact)
        .where(inArray(schema.reportArtifact.reportJobId, createdJobIds));

      await db
        .delete(schema.reportJob)
        .where(inArray(schema.reportJob.id, createdJobIds));
    }
  }
}

main()
  .then(() => {
    console.log("[reporting-integration] PASS");
    process.exit(0);
  })
  .catch((error: unknown) => {
    const message =
      error instanceof Error ? (error.stack ?? error.message) : String(error);
    console.error("[reporting-integration] FAIL");
    console.error(message);
    process.exit(1);
  });
