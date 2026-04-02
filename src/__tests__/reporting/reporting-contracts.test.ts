/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CsvExportStrategy } from "~/server/services/reporting/exporters";
import {
  buildReportFingerprint,
  canonicalJsonString,
} from "~/server/services/reporting/normalization";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Reporting contract coverage (Invariant #9)", () => {
  it("reporting_fingerprint_is_canonical_for_equivalent_requests", () => {
    const first = buildReportFingerprint({
      reportType: "user_activity",
      parameters: {
        includeArchived: false,
        region: "west",
      },
      scope: {
        userId: "user-123",
        scopeType: "user",
      },
      timeRangeFrom: new Date("2026-01-01T00:00:00.000Z"),
      timeRangeTo: new Date("2026-01-31T23:59:59.000Z"),
      granularity: "daily",
      snapshotId: "snapshot-001",
      templateVersion: "v3",
      policyVersion: "policy-v9",
    });

    const second = buildReportFingerprint({
      reportType: "user_activity",
      parameters: {
        region: "west",
        includeArchived: false,
      },
      scope: {
        scopeType: "user",
        userId: "user-123",
      },
      timeRangeFrom: new Date("2026-01-01T00:00:00.000Z"),
      timeRangeTo: new Date("2026-01-31T23:59:59.000Z"),
      granularity: "daily",
      snapshotId: "snapshot-001",
      templateVersion: "v3",
      policyVersion: "policy-v9",
    });

    expect(first.canonical).toBe(second.canonical);
    expect(first.hash).toBe(second.hash);
    expect(first.hash).toHaveLength(64);
    expect(canonicalJsonString({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  it("reporting_csv_export_is_stable_for_row_and_metadata_reordering", async () => {
    const exporter = new CsvExportStrategy();

    const first = await exporter.export({
      data: {
        reportType: "audit_trail",
        generatedAtIso: "2026-02-10T12:00:00.000Z",
        scope: {
          scopeType: "district",
          districtId: "00000000-0000-0000-0000-000000000001",
        },
        rows: [
          {
            eventType: "download",
            actorId: "user-a",
            payload: { id: 2, label: "beta" },
          },
          {
            actorId: "user-b",
            eventType: "generate",
            payload: { label: "alpha", id: 1 },
          },
        ],
      },
      templateVersion: "report-v2",
      metadata: {
        issuedBy: "reporting-engine",
        channel: "scheduled",
      },
    });

    const second = await exporter.export({
      data: {
        reportType: "audit_trail",
        generatedAtIso: "2026-02-10T12:00:00.000Z",
        scope: {
          districtId: "00000000-0000-0000-0000-000000000001",
          scopeType: "district",
        },
        rows: [
          {
            eventType: "generate",
            payload: { id: 1, label: "alpha" },
            actorId: "user-b",
          },
          {
            payload: { label: "beta", id: 2 },
            actorId: "user-a",
            eventType: "download",
          },
        ],
      },
      templateVersion: "report-v2",
      metadata: {
        channel: "scheduled",
        issuedBy: "reporting-engine",
      },
    });

    expect(first.outputHash).toBe(second.outputHash);
    expect(first.payload.toString("utf8")).toBe(
      second.payload.toString("utf8"),
    );
    expect(first.contentType).toBe("text/csv; charset=utf-8");
  });

  it("reporting_download_links_are_explicitly_time_bound", () => {
    const orchestratorSource = readSource(
      "src/server/services/reporting/ReportingOrchestrator.ts",
    );

    const routeSource = readSource(
      "src/app/api/reports/download/[artifactId]/route.ts",
    );

    expect(orchestratorSource).toContain(
      "artifact.expiresAt && artifact.expiresAt < new Date()",
    );
    expect(orchestratorSource).toContain(
      "const expiresAt = addDays(new Date(), 1)",
    );
    expect(orchestratorSource).toContain(
      "signedUrl: `/api/reports/download/${artifact.id}`",
    );
    expect(routeSource).toContain(
      "artifact.expiresAt && artifact.expiresAt < new Date()",
    );
    expect(routeSource).toContain('"ARTIFACT_EXPIRED"');
  });
});
