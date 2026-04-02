import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("TimescaleDB aggregation contract (Invariant #9)", () => {
  it("timescaledb_time_bucket_groups_boundary_rows_correctly", () => {
    const analyticsSource = readSource("src/server/api/routers/analytics.ts");

    expect(analyticsSource).toContain("time_bucket(${`${input.bucketMinutes} minutes`}::interval, timestamp) AS bucket");
    expect(analyticsSource).toContain("timestamp BETWEEN ${input.from.toISOString()}::timestamptz");
    expect(analyticsSource).toContain("AND timestamp BETWEEN ${input.from.toISOString()}::timestamptz");
    expect(analyticsSource).toContain("GROUP BY bucket");
    expect(analyticsSource).toContain("ORDER BY bucket ASC");
  });

  it("timescaledb_chunk_boundary_queries_do_not_double_count", () => {
    const metricsRouteSource = readSource("src/app/api/wells/[id]/metrics/route.ts");

    expect(metricsRouteSource).toContain("time_bucket(${bucketMinutes.toString() + \" minutes\"}::interval, sd.timestamp) AS bucket");
    expect(metricsRouteSource).toContain("sd.timestamp >= NOW() - (${rangeHours.toString()} || ' hours')::interval");
    expect(metricsRouteSource).toContain("GROUP BY bucket, s.type, s.unit");
    expect(metricsRouteSource).toContain("ORDER BY bucket ASC");
  });
});
