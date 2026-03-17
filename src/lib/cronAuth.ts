import { createHash, timingSafeEqual } from "crypto";

import { env } from "~/env";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function getSecretFromHeaders(headers: Headers): string | null {
  const auth = headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();

  const secretHeader = headers.get("x-cron-secret");
  if (secretHeader) return secretHeader.trim();

  return null;
}

export function validateCronRequest(headers: Headers): {
  ok: boolean;
  reason?: string;
} {
  if (!env.CRON_SECRET) {
    return { ok: false, reason: "CRON_SECRET is not configured" };
  }

  const incoming = getSecretFromHeaders(headers);
  if (!incoming) {
    return { ok: false, reason: "Missing cron secret" };
  }

  const expectedDigest = digest(env.CRON_SECRET);
  const incomingDigest = digest(incoming);

  const valid = timingSafeEqual(expectedDigest, incomingDigest);
  if (!valid) {
    return { ok: false, reason: "Invalid cron secret" };
  }

  return { ok: true };
}
