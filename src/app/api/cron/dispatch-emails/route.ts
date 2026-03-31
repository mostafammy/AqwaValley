/**
 * Email Dispatch Cron — Transactional Outbox Consumer
 *
 * Route: POST /api/cron/dispatch-emails
 * Schedule: every 1 minute (vercel.json)
 * Auth: CRON_SECRET bearer header (identical to all other cron routes)
 *
 * Reads pending outbox_event rows, dispatches email via EmailService,
 * marks processed_at on success. Increments attempts + sets nextRetryAt on failure.
 * Dead-letters at maxAttempts with status = 'dead'.
 *
 * Crash safety: outbox row persists if server dies mid-dispatch.
 * Next cron tick picks it up and retries.
 */

import { NextResponse } from "next/server";
import { and, eq, isNull, lte, or } from "drizzle-orm";
import { db } from "~/server/db";
import { outboxEvent } from "~/server/db/schema";
import { env } from "~/env";
import { NodeMailerTransport } from "~/server/services/email/NodeMailerTransport";
import { NullTransport } from "~/server/services/email/NullTransport";
import { AuditingEmailTransport } from "~/server/services/email/AuditingEmailTransport";
import { EmailService } from "~/server/services/email/EmailService";
import type { OutboxPayload } from "~/server/services/email/interfaces";

const BATCH_SIZE = 50;

// Build transport based on environment
function buildEmailService(): EmailService {
  const isTestEnv =
    env.NODE_ENV === "test" || !env.SMTP_HOST || env.SMTP_HOST === "localhost";

  const baseTransport = isTestEnv
    ? new NullTransport()
    : new NodeMailerTransport({
        host: env.SMTP_HOST!,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
        from: env.EMAIL_FROM,
      });

  // Decorator: wrap with auditing regardless of transport type
  const auditedTransport = new AuditingEmailTransport(baseTransport, db);

  return new EmailService(auditedTransport, env.EMAIL_FROM);
}

export async function POST(req: Request): Promise<NextResponse> {
  // Verify CRON_SECRET (identical pattern to all other cron routes)
  const authHeader = req.headers.get("authorization");
  const expectedSecret = `Bearer ${env.CRON_SECRET ?? ""}`;

  if (!authHeader || authHeader !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  let processed = 0;
  let failed = 0;
  let deadLettered = 0;

  try {
    const emailService = buildEmailService();

    // Select pending events, respect nextRetryAt for backoff
    const pendingEvents = await db.query.outboxEvent.findMany({
      where: and(
        or(
          eq(outboxEvent.status, "pending"),
          eq(outboxEvent.status, "processing"),
        ),
        or(
          isNull(outboxEvent.nextRetryAt),
          lte(outboxEvent.nextRetryAt, new Date()),
        ),
      ),
      limit: BATCH_SIZE,
      orderBy: (ev, { asc }) => [asc(ev.createdAt)],
    });

    // Process with allSettled — individual failures don't abort the batch
    await Promise.allSettled(
      pendingEvents.map(async (event) => {
        // Mark as processing to prevent concurrent dispatch
        await db
          .update(outboxEvent)
          .set({ status: "processing" })
          .where(eq(outboxEvent.id, event.id));

        try {
          const payload = event.payload as OutboxPayload;
          const recipientEmail = extractRecipientEmail(payload);

          if (!recipientEmail) {
            throw new Error("Outbox event missing recipientEmail in payload");
          }

          await emailService.dispatch(recipientEmail, payload);

          // Mark done
          await db
            .update(outboxEvent)
            .set({ status: "done", processedAt: new Date() })
            .where(eq(outboxEvent.id, event.id));

          processed++;
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          const newAttempts = (event.attempts ?? 0) + 1;
          const isDead = newAttempts >= (event.maxAttempts ?? 5);

          // Exponential backoff: 1min, 5min, 30min, 2h
          const backoffMs =
            [60, 300, 1800, 7200][Math.min(newAttempts - 1, 3)]! * 1000;
          const nextRetryAt = isDead ? null : new Date(Date.now() + backoffMs);

          await db
            .update(outboxEvent)
            .set({
              status: isDead ? "dead" : "pending",
              attempts: newAttempts,
              lastError: errorMsg,
              nextRetryAt,
            })
            .where(eq(outboxEvent.id, event.id));

          if (isDead) deadLettered++;
          else failed++;
        }
      }),
    );

    const durationMs = Date.now() - startedAt;

    return NextResponse.json({
      ok: true,
      processed,
      failed,
      deadLettered,
      total: pendingEvents.length,
      durationMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[dispatch-emails cron] Fatal error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// Vercel Cron jobs issue GET requests. Support them by delegating to POST logic.
export async function GET(req: Request): Promise<NextResponse> {
  return POST(req);
}

/** Extract recipient email from any outbox payload type */
function extractRecipientEmail(payload: OutboxPayload): string | null {
  if ("recipientEmail" in payload) {
    return payload.recipientEmail;
  }
  return null;
}
