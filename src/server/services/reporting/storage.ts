import { mkdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";

// Keep this path static so Next output tracing doesn't conservatively include
// broad workspace directories for env-driven filesystem roots.
const REPORT_ARTIFACT_ROOT = path.resolve(process.cwd(), ".reports");

function sanitizeStorageKey(storageKey: string): string {
  const normalized = path.posix.normalize(storageKey).replace(/^\/+/, "");
  if (normalized.includes("..")) {
    throw new Error("Invalid storage key");
  }
  return normalized;
}

function toAbsolutePath(storageKey: string): string {
  const safeKey = sanitizeStorageKey(storageKey);
  return path.join(REPORT_ARTIFACT_ROOT, safeKey);
}

export async function persistArtifact(params: {
  storageKey: string;
  payload: Buffer;
}): Promise<{ absolutePath: string; sizeBytes: number }> {
  const absolutePath = toAbsolutePath(params.storageKey);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, params.payload);
  const fileInfo = await stat(absolutePath);
  return { absolutePath, sizeBytes: fileInfo.size };
}

export async function loadArtifactBuffer(storageKey: string): Promise<Buffer> {
  const absolutePath = toAbsolutePath(storageKey);
  return readFile(absolutePath);
}

export function resolveArtifactAbsolutePath(storageKey: string): string {
  return toAbsolutePath(storageKey);
}
