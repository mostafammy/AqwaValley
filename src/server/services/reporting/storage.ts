import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, readFile, stat, unlink, writeFile } from "fs/promises";
import path from "path";

// Keep these roots static so Next output tracing doesn't conservatively include
// broad workspace directories for env-driven filesystem roots.
const LOCAL_REPORT_ARTIFACT_ROOT = path.resolve(process.cwd(), ".reports");
const SERVERLESS_REPORT_ARTIFACT_ROOT = path.resolve("/tmp", ".reports");

type ReportStorageBackend = "fs" | "r2";

let r2ClientSingleton: S3Client | null = null;

function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.VERCEL ??
    process.env.AWS_LAMBDA_FUNCTION_NAME ??
    process.env.LAMBDA_TASK_ROOT,
  );
}

function getReportArtifactRoot(): string {
  const configured =
    process.env.REPORT_ARTIFACT_ROOT?.trim() ??
    process.env.REPORT_ARTIFACT_DIR?.trim();
  if (configured) {
    return path.resolve(configured);
  }

  return isServerlessRuntime()
    ? SERVERLESS_REPORT_ARTIFACT_ROOT
    : LOCAL_REPORT_ARTIFACT_ROOT;
}

function getStorageBackend(): ReportStorageBackend {
  const configured = process.env.REPORT_STORAGE_BACKEND?.trim().toLowerCase();
  if (configured === "r2") return "r2";
  return "fs";
}

export function isR2StorageEnabled(): boolean {
  return getStorageBackend() === "r2";
}

function requireR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = process.env.R2_BUCKET_NAME?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error(
      "R2 storage is enabled but required environment variables are missing",
    );
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
  };
}

function getR2Client() {
  if (r2ClientSingleton) return r2ClientSingleton;

  const cfg = requireR2Config();
  r2ClientSingleton = new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });

  return r2ClientSingleton;
}

async function streamToBuffer(
  stream: AsyncIterable<Uint8Array | string>,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
      continue;
    }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function sanitizeStorageKey(storageKey: string): string {
  const normalized = path.posix.normalize(storageKey).replace(/^\/+/, "");
  if (normalized.includes("..")) {
    throw new Error("Invalid storage key");
  }
  return normalized;
}

function toAbsolutePath(storageKey: string): string {
  const safeKey = sanitizeStorageKey(storageKey);
  return path.join(getReportArtifactRoot(), safeKey);
}

export async function persistArtifact(params: {
  storageKey: string;
  payload: Buffer;
  contentType?: string;
}): Promise<{ absolutePath: string; sizeBytes: number }> {
  const safeKey = sanitizeStorageKey(params.storageKey);

  if (getStorageBackend() === "r2") {
    const cfg = requireR2Config();
    const client = getR2Client();
    await client.send(
      new PutObjectCommand({
        Bucket: cfg.bucketName,
        Key: safeKey,
        Body: params.payload,
        ContentType: params.contentType,
      }),
    );

    return {
      absolutePath: `r2://${cfg.bucketName}/${safeKey}`,
      sizeBytes: params.payload.byteLength,
    };
  }

  const absolutePath = toAbsolutePath(safeKey);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, params.payload);
  const fileInfo = await stat(absolutePath);
  return { absolutePath, sizeBytes: fileInfo.size };
}

export async function loadArtifactBuffer(storageKey: string): Promise<Buffer> {
  const safeKey = sanitizeStorageKey(storageKey);

  if (getStorageBackend() === "r2") {
    const cfg = requireR2Config();
    const client = getR2Client();
    const output = await client.send(
      new GetObjectCommand({
        Bucket: cfg.bucketName,
        Key: safeKey,
      }),
    );

    if (!output.Body) {
      throw new Error("Artifact body is empty");
    }

    if (typeof output.Body.transformToByteArray === "function") {
      const bytes = await output.Body.transformToByteArray();
      return Buffer.from(bytes);
    }

    return streamToBuffer(output.Body as AsyncIterable<Uint8Array | string>);
  }

  const absolutePath = toAbsolutePath(safeKey);
  return readFile(absolutePath);
}

export async function deleteArtifact(storageKey: string): Promise<void> {
  const safeKey = sanitizeStorageKey(storageKey);

  if (getStorageBackend() === "r2") {
    const cfg = requireR2Config();
    const client = getR2Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: cfg.bucketName,
        Key: safeKey,
      }),
    );
    return;
  }

  const absolutePath = toAbsolutePath(safeKey);
  await unlink(absolutePath);
}

export async function createArtifactDownloadLink(params: {
  storageKey: string;
  expiresInSeconds: number;
  contentType?: string;
  filename?: string;
}): Promise<{ url: string; expiresAt: Date } | null> {
  if (!isR2StorageEnabled()) {
    return null;
  }

  const cfg = requireR2Config();
  const client = getR2Client();
  const safeKey = sanitizeStorageKey(params.storageKey);
  const expiresIn = Math.max(
    60,
    Math.min(86400, Math.floor(params.expiresInSeconds)),
  );
  const safeFilename = params.filename?.replaceAll('"', "").trim();

  const url = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: cfg.bucketName,
      Key: safeKey,
      ResponseContentType: params.contentType,
      ResponseContentDisposition: safeFilename
        ? `attachment; filename="${safeFilename}"`
        : undefined,
    }),
    { expiresIn },
  );

  return {
    url,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  };
}
