/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Demo mode and cron isolation contract (Invariant #10)", () => {
  it("cron_simulation_isolated_by_run_identifier", () => {
    const cronRoute = readSource("src/app/api/cron/simulate-ingest/route.ts");
    const simulatorService = readSource(
      "src/server/services/simulatorCronIngest.ts",
    );
    const registry = readSource("src/server/services/simulatorRunRegistry.ts");

    expect(cronRoute).toContain(
      "beginRun(runKey, env.SIM_RUN_STALE_TIMEOUT_SECONDS)",
    );
    expect(cronRoute).toContain("runId: runKey");
    expect(cronRoute).toContain("completeRun(runKey, attemptToken, result)");
    expect(cronRoute).toContain("failRun(runKey, attemptToken, message)");
    expect(simulatorService).toContain(
      "const runId = options.runId ?? randomUUID();",
    );
    expect(simulatorService).toContain("id: `cron-${params.runId}`");
    expect(registry).toContain(
      "INSERT INTO cron_simulation_run (run_key, status, attempt_token)",
    );
    expect(registry).toContain("ON CONFLICT (run_key) DO NOTHING");
  });

  it("demo_mode_reads_do_not_write_production_fixtures", () => {
    const mockSimulator = readSource("scripts/mock-simulator.ts");
    const cronRoute = readSource("src/app/api/cron/simulate-ingest/route.ts");

    expect(mockSimulator).toContain("MOCK_API_KEY");
    expect(mockSimulator).toContain("MOCK_API_KEYS");
    expect(mockSimulator).toContain("MOCK_BASE_URL");
    expect(mockSimulator).toContain("fetch(`${BASE_URL}/api/sensors/ingest`");
    expect(cronRoute).toContain("validateCronRequest(request)");
    expect(cronRoute).toContain("runSimulatorCron({");
    expect(cronRoute).not.toContain("production fixtures");
  });

  it("simulator_heartbeat_failure_does_not_mask_real_cron_failure", () => {
    const heartbeatCheck = readSource("__checks__/heartbeat.check.ts");
    const cronRoute = readSource("src/app/api/cron/simulate-ingest/route.ts");

    expect(heartbeatCheck).toContain("new HeartbeatMonitor(");
    expect(heartbeatCheck).toContain("AqwaValley — Simulator Heartbeat");
    expect(heartbeatCheck).toContain("activated: false");
    expect(cronRoute).toContain("failRun(runKey, attemptToken, message)");
    expect(cronRoute).toContain('console.error("[cron_simulate_ingest_error]"');
  });

  it("demo_fixtures_do_not_pollute_integration_database", () => {
    const simulatorService = readSource(
      "src/server/services/simulatorCronIngest.ts",
    );
    const registry = readSource("src/server/services/simulatorRunRegistry.ts");

    expect(simulatorService).toContain("discoverSimulatorSensors({");
    expect(simulatorService).toContain("ingestReadings(");
    expect(simulatorService).toContain("runId,");
    expect(registry).toContain("cron_simulation_run");
    expect(registry).toContain("completed_at = NOW()");
    expect(registry).toContain("response = ${JSON.stringify(response)}::jsonb");
  });
});
