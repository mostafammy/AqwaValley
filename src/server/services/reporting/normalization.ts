import { createHash } from "crypto";

function normalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map((item) => normalizeValue(item));
  if (value instanceof Date) return value.toISOString();

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const normalized: Record<string, unknown> = {};
    for (const key of keys) {
      normalized[key] = normalizeValue(record[key]);
    }
    return normalized;
  }

  return value;
}

export function canonicalJsonString(value: unknown): string {
  return JSON.stringify(normalizeValue(value));
}

export function hashSha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function buildReportFingerprint(input: {
  reportType: string;
  parameters: Record<string, unknown>;
  scope: Record<string, unknown>;
  timeRangeFrom?: Date;
  timeRangeTo?: Date;
  granularity: string;
  snapshotId: string;
  templateVersion: string;
  policyVersion: string;
}): { canonical: string; hash: string } {
  const canonical = canonicalJsonString({
    reportType: input.reportType,
    parameters: input.parameters,
    scope: input.scope,
    timeRangeFrom: input.timeRangeFrom?.toISOString() ?? null,
    timeRangeTo: input.timeRangeTo?.toISOString() ?? null,
    granularity: input.granularity,
    snapshotId: input.snapshotId,
    templateVersion: input.templateVersion,
    policyVersion: input.policyVersion,
  });

  return { canonical, hash: hashSha256(canonical) };
}
