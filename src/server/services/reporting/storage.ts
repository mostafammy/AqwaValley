import { mkdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";
import { env } from "~/env";

const REPORT_ARTIFACT_ROOT = path.resolve(
  process.cwd(),
  String(env.REPORT_ARTIFACT_DIR),
);

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
