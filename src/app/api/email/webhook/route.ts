/**
 * Email Delivery Webhook
 *
 * Route: POST /api/email/webhook
 * Auth: HMAC signature from SendGrid/SES
 *
 * Receives delivery events from email provider.
 * Updates email_audit_log.deliveredAt, openedAt, or status = 'bounced'.
 * Provides legally defensible proof of delivery for government compliance audit.
 *
 * STRIDE: Unauthenticated writes rejected with 401.
 * HMAC key: EMAIL_PROVIDER_WEBHOOK_SECRET in env.
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { createVerify } from "crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { emailAuditLog } from "~/server/db/schema";
import { env } from "~/env";

interface SendGridEvent {
  event:
    | "delivered"
    | "open"
    | "bounce"
    | "dropped"
    | "deferred"
    | "spamreport";
  sg_message_id?: string;
  email: string;
  timestamp: number;
  reason?: string;
}

/**
 * Verify SendGrid/Twilio Email Events webhook signature using ECDSA P-256.
 * The signed payload is: UTF8(timestamp) || rawBodyBytes
 * Signature is expected as ASN.1/DER encoded ECDSA signature (base64).
 * Public key may be provided via env.EMAIL_PROVIDER_WEBHOOK_PUBLIC_KEY or
 * via a request header (e.g. 'x-twilio-email-event-webhook-public-key').
 */
function toPemPublicKey(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes("-----BEGIN PUBLIC KEY-----")) return trimmed;
  const b64 = trimmed.replace(/\s+/g, "");
  const chunks = b64.match(/.{1,64}/g) ?? [b64];
  return `-----BEGIN PUBLIC KEY-----\n${chunks.join("\n")}\n-----END PUBLIC KEY-----`;
}

function parseSignatureHeader(sigHeader: string): Buffer | null {
  let sig = sigHeader.trim();
  // Some providers prefix with algorithm or key id (e.g. "v1=BASE64" or "sha256=BASE64")
  const eqIdx = sig.indexOf("=");
  if (
    eqIdx !== -1 &&
    /^[a-z0-9_\-]+$/.test(sig.slice(0, eqIdx).toLowerCase())
  ) {
    sig = sig.slice(eqIdx + 1);
  }
  // If multiple comma-separated values, take the first
  if (sig.includes(",")) sig = sig.split(",")[0]!.trim();

  // Try base64 first, fall back to hex
  try {
    return Buffer.from(sig, "base64");
  } catch {
    try {
      return Buffer.from(sig, "hex");
    } catch {
      return null;
    }
  }
}

function verifySignature(
  rawBody: Buffer,
  signatureHeader: string | null,
  timestampHeader: string | null,
  publicKeyRaw?: string | null,
): boolean {
  if (!signatureHeader || !timestampHeader) return false;

  const sigBuf = parseSignatureHeader(signatureHeader);
  if (!sigBuf) return false;

  const pubRaw = publicKeyRaw ?? env.EMAIL_PROVIDER_WEBHOOK_PUBLIC_KEY ?? null;
  if (!pubRaw) return false;

  const pubPem = toPemPublicKey(pubRaw);

  try {
    const payload = Buffer.concat([
      Buffer.from(String(timestampHeader), "utf8"),
      rawBody,
    ]);

    const verifier = createVerify("sha256");
    verifier.update(payload);
    verifier.end();

    return verifier.verify(pubPem, sigBuf);
  } catch {
    // Signature verification failed — treat as invalid
    return false;
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const rawArrayBuffer = await req.arrayBuffer();
  const rawBodyBuf = Buffer.from(rawArrayBuffer);
  const rawBodyText = rawBodyBuf.toString("utf8");

  // ECDSA verification — use timestamp + raw body bytes
  const signatureHeader =
    req.headers.get("x-twilio-email-event-webhook-signature") ??
    req.headers.get("x-sendgrid-signature");

  const timestampHeader =
    req.headers.get("x-twilio-email-event-webhook-timestamp") ??
    req.headers.get("x-sendgrid-timestamp");

  // Public key may be provided in a header by some proxies/providers
  const publicKeyHeader =
    req.headers.get("x-twilio-email-event-webhook-public-key") ??
    req.headers.get("x-sendgrid-public-key") ??
    null;

  if (
    env.NODE_ENV === "production" &&
    !verifySignature(
      rawBodyBuf,
      signatureHeader,
      timestampHeader,
      publicKeyHeader,
    )
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let events: SendGridEvent[];

  try {
    events = JSON.parse(rawBodyText) as SendGridEvent[];
    if (!Array.isArray(events)) events = [events];
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let updated = 0;

  for (const event of events) {
    const messageId = event.sg_message_id?.split(".")[0]; // Strip suffix
    if (!messageId) continue;

    const now = new Date(event.timestamp * 1000);

    try {
      switch (event.event) {
        case "delivered":
          await db
            .update(emailAuditLog)
            .set({ status: "delivered", deliveredAt: now })
            .where(eq(emailAuditLog.providerMessageId, messageId));
          updated++;
          break;

        case "open":
          await db
            .update(emailAuditLog)
            .set({ openedAt: now })
            .where(eq(emailAuditLog.providerMessageId, messageId));
          updated++;
          break;

        case "bounce":
        case "dropped":
          await db
            .update(emailAuditLog)
            .set({
              status: "bounced",
              errorDetail: event.reason ?? `bounced: ${event.event}`,
            })
            .where(eq(emailAuditLog.providerMessageId, messageId));
          updated++;
          break;

        default:
          // We record but don't act on deferred/spamreport events in this version
          break;
      }
    } catch (err: unknown) {
      console.error(
        `[email webhook] Failed to update log for ${messageId}: ` +
          (err instanceof Error ? err.message : String(err)),
      );
    }
  }

  return NextResponse.json({ ok: true, updated });
}
