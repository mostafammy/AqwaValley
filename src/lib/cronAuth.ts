import { Receiver } from "@upstash/qstash";

let receiver: Receiver | null = null;

function getSignature(headers: Headers): string | null {
  return headers.get("upstash-signature") ?? headers.get("Upstash-Signature");
}

function getReceiver(): Receiver | null {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (!currentSigningKey || !nextSigningKey) {
    return null;
  }

  receiver ??= new Receiver({ currentSigningKey, nextSigningKey });
  return receiver;
}

export async function validateCronRequest(request: Request): Promise<{
  ok: boolean;
  reason?: string;
}> {
  const signature = getSignature(request.headers);
  const cronSecret = process.env.CRON_SECRET;

  // Fallback to CRON_SECRET validation if signature is missing (useful for local testing/direct calls)
  if (!signature) {
    if (!cronSecret) {
      return { ok: false, reason: "Missing Upstash-Signature header and no CRON_SECRET configured" };
    }

    const authHeader = request.headers.get("authorization");
    const xCronSecret = request.headers.get("x-cron-secret");
    const providedSecret = xCronSecret ?? (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null);

    if (providedSecret === cronSecret) {
      return { ok: true };
    }

    return { ok: false, reason: "Missing Upstash-Signature header and invalid/missing CRON_SECRET" };
  }

  const qstashReceiver = getReceiver();
  if (!qstashReceiver) {
    return {
      ok: false,
      reason:
        "QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY must be configured",
    };
  }

  const body = await request.clone().text();

  try {
    await qstashReceiver.verify({
      signature,
      body,
      url: request.url,
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: "Invalid QStash signature" };
  }
}
