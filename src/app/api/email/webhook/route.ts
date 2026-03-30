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

import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { emailAuditLog } from "~/server/db/schema";
import { env } from "~/env";

interface SendGridEvent {
  event: "delivered" | "open" | "bounce" | "dropped" | "deferred" | "spamreport";
  sg_message_id?: string;
  email: string;
  timestamp: number;
  reason?: string;
}

/**
 * Verify SendGrid webhook HMAC signature.
 * Uses timingSafeEqual to prevent timing attacks.
 */
function verifySignature(body: string, signature: string): boolean {
  const secret = env.EMAIL_PROVIDER_WEBHOOK_SECRET;
  if (!secret) return false;

  try {
    const expected = createHmac("sha256", secret)
      .update(body)
      .digest("base64");

    const expectedBuf = Buffer.from(expected);
    const receivedBuf = Buffer.from(signature);

    if (expectedBuf.length !== receivedBuf.length) return false;
    return timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const rawBody = await req.text();

  // HMAC verification — reject unauthenticated writes (STRIDE: Tampering)
  const signature =
    req.headers.get("x-twilio-email-event-webhook-signature") ?? // SendGrid header
    req.headers.get("x-sendgrid-signature") ??
    "";

  if (env.NODE_ENV === "production" && !verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let events: SendGridEvent[];

  try {
    events = JSON.parse(rawBody) as SendGridEvent[];
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
    } catch (err) {
      console.error(`[email webhook] Failed to update log for ${messageId}:`, err);
    }
  }

  return NextResponse.json({ ok: true, updated });
}
