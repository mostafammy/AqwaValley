import { createHash } from "crypto";

type CanonicalValue =
  | null
  | boolean
  | number
  | string
  | CanonicalValue[]
  | { [key: string]: CanonicalValue };

function normalizeNumber(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Number(value.toFixed(10));
}

function normalize(value: unknown): CanonicalValue {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "number") {
    return normalizeNumber(value);
  }

  if (
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalize(item));
  }

  if (typeof value === "object") {
    const input = value as Record<string, unknown>;
    const keys = Object.keys(input).sort();
    const output: Record<string, CanonicalValue> = {};
    for (const key of keys) {
      output[key] = normalize(input[key]);
    }
    return output;
  }

  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(value);
}

export function canonicalJsonString(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashCanonical(value: unknown): string {
  return sha256Hex(canonicalJsonString(value));
}
