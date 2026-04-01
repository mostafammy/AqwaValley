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
  if (!signature) {
    return { ok: false, reason: "Missing Upstash-Signature header" };
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
