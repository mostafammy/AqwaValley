import { createHash, randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";

import { db } from "~/server/db";
import { apiKey } from "~/server/db/schema";

/**
 * Produce a deterministic SHA-256 hex hash of a raw API key string.
 * Used for secure storage — the plaintext key is never persisted.
 */
export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Generate a cryptographically secure 256-bit (64-char hex) API key.
 * The raw value is returned ONCE; only its hash is stored.
 */
export function generateApiKey(): string {
  return randomBytes(32).toString("hex");
}

export type ApiKeyContext = {
  id: string;
  name: string;
  wellId: string | null;
};

/**
 * Validate a raw API key from an HTTP header.
 * Hashes the input, queries the DB, checks active + expiry,
 * and kick-starts a fire-and-forget `lastUsedAt` update.
 *
 * @returns Resolved key context or null if invalid/expired
 */
export async function validateApiKey(
  rawKey: string,
): Promise<ApiKeyContext | null> {
  const hashed = hashApiKey(rawKey);
  const now = new Date();

  const results = await db
    .select({
      id: apiKey.id,
      name: apiKey.name,
      wellId: apiKey.wellId,
      expiresAt: apiKey.expiresAt,
    })
    .from(apiKey)
    .where(and(eq(apiKey.hashedKey, hashed), eq(apiKey.isActive, true)))
    .limit(1);

  const record = results[0];
  if (!record) return null;
  if (record.expiresAt && record.expiresAt < now) return null;

  // Fire-and-forget — do not await to keep ingest latency minimal
  void db
    .update(apiKey)
    .set({ lastUsedAt: now })
    .where(eq(apiKey.id, record.id));

  return { id: record.id, name: record.name, wellId: record.wellId };
}

/**
 * Extract the raw API key from a request.
 * Supports both `X-API-Key` header and `Authorization: Bearer <key>`.
 */
export function extractApiKey(headers: Headers): string | null {
  const xApiKey = headers.get("x-api-key");
  if (xApiKey) return xApiKey;

  const auth = headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);

  return null;
}
