import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { extractApiKey, validateApiKey } from "~/lib/apiKeyAuth";
import { ingestReadings } from "~/server/services/ingestService";
import { logger } from "~/lib/logger";
import { env } from "~/env";

// In-memory sliding window rate limiter (per API key ID)
// For multi-instance deployments, replace with Redis INCR+EXPIRE
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(keyId: string): boolean {
  const now = Date.now();
  const windowMs = 60_000; // 1 minute
  const limit = env.INGEST_RATE_LIMIT_PER_MINUTE;

  const entry = rateLimitMap.get(keyId);
  if (!entry || now - entry.windowStart >= windowMs) {
    rateLimitMap.set(keyId, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= limit) return false;

  entry.count += 1;
  return true;
}

// --- Zod schemas ---
const singleReadingSchema = z.object({
  sensorId: z.string().uuid(),
  value: z.number().finite(),
  timestamp: z
    .string()
    .datetime({ offset: true })
    .transform((s) => new Date(s))
    .or(z.date()),
});

const batchBodySchema = z.object({
  readings: z.array(singleReadingSchema).min(1).max(500),
});

const singleBodySchema = singleReadingSchema;

export async function POST(request: NextRequest) {
  // 1. Extract and validate API key
  const rawKey = extractApiKey(request.headers);
  if (!rawKey) {
    return NextResponse.json(
      { error: "Missing API key. Use X-API-Key header or Authorization: Bearer <key>" },
      { status: 401 },
    );
  }

  const apiKeyCtx = await validateApiKey(rawKey);
  if (!apiKeyCtx) {
    logger.warn({ path: "/api/sensors/ingest" }, "auth.invalid_api_key");
    return NextResponse.json({ error: "Invalid or expired API key" }, { status: 401 });
  }

  // 2. Rate limiting
  if (!checkRateLimit(apiKeyCtx.id)) {
    logger.warn({ apiKeyId: apiKeyCtx.id }, "ratelimit.exceeded");
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429 },
    );
  }

  // 3. Parse body — accept both single reading and batch
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let readings: z.infer<typeof singleReadingSchema>[];

  // Detect batch vs single
  if (typeof body === "object" && body !== null && "readings" in body) {
    const parsed = batchBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 },
      );
    }
    readings = parsed.data.readings;
  } else {
    const parsed = singleBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 },
      );
    }
    readings = [parsed.data];
  }

  // 4. Ingest
  const result = await ingestReadings(apiKeyCtx, readings);

  const status = result.accepted > 0 ? 200 : 422;
  return NextResponse.json(result, { status });
}
