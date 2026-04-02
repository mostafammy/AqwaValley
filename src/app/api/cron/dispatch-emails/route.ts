/**
 * Email Dispatch Cron — Transactional Outbox Consumer
 *
 * Route: POST /api/cron/dispatch-emails
 * Schedule: managed by external scheduler (QStash sync)
 * Auth: Native QStash signature verification (Upstash-Signature)
 *
 * Reads pending outbox_event rows, dispatches email via EmailService,
 * marks processed_at on success. Increments attempts + sets nextRetryAt on failure.
 * Dead-letters at maxAttempts with status = 'dead'.
 *
 * Crash safety: outbox row persists if server dies mid-dispatch.
 * Next cron tick picks it up and retries.
 */

import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "~/server/db";
import { outboxEvent, userNotificationPreference } from "~/server/db/schema";
import { env } from "~/env";
import { NodeMailerTransport } from "~/server/services/email/NodeMailerTransport";
import { NullTransport } from "~/server/services/email/NullTransport";
import { AuditingEmailTransport } from "~/server/services/email/AuditingEmailTransport";
import { EmailService } from "~/server/services/email/EmailService";
import type { OutboxPayload } from "~/server/services/email/interfaces";
import { validateCronRequest } from "~/lib/cronAuth";

const BATCH_SIZE = 50;

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const maybe = result as { rows?: T[] };
  return maybe.rows ?? [];
}

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

async function isRecipientOptedOut(
  recipientUserId: string | null,
): Promise<boolean> {
  if (!recipientUserId) return false;

  const preference = await db.query.userNotificationPreference.findFirst({
    where: and(
      eq(userNotificationPreference.userId, recipientUserId),
      eq(userNotificationPreference.emailOptOut, true),
    ),
    columns: { userId: true },
  });

  return Boolean(preference);
}

export async function POST(req: Request): Promise<NextResponse> {
  const authResult = await validateCronRequest(req);
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.reason ?? "Unauthorized" },
      { status: 401 },
    );
  }

  const startedAt = Date.now();
  let processed = 0;
  let failed = 0;
  let deadLettered = 0;

  try {
    const emailService = buildEmailService();

    // Atomically claim up to BATCH_SIZE pending events using row locking
    const pendingEvents = await db.transaction(async (tx) => {
      // Lock candidate rows and avoid races with SKIP LOCKED
      const lockResult = await tx.execute(sql`
        SELECT id FROM outbox_event
        WHERE (status = 'pending' OR status = 'processing')
          AND (next_retry_at IS NULL OR next_retry_at <= now())
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${BATCH_SIZE}
      `);

      const locked = rowsOf<{ id: string }>(lockResult);
      const ids = locked.map((r) => r.id);
      if (!ids.length) return [];

      // Mark claimed rows as processing and return the claimed rows (Drizzle will map to camelCase)
      const claimed = await tx
        .update(outboxEvent)
        .set({ status: "processing" })
        .where(inArray(outboxEvent.id, ids))
        .returning();

      return claimed;
    });

    // Process with allSettled — individual failures don't abort the batch
    await Promise.allSettled(
      pendingEvents.map(async (event) => {
        try {
          const payload = event.payload as OutboxPayload;
          const recipientEmail = extractRecipientEmail(payload);

          if (!recipientEmail) {
            throw new Error("Outbox event missing recipientEmail in payload");
          }

          const recipientUserId = extractRecipientUserId(payload);
          if (await isRecipientOptedOut(recipientUserId)) {
            await db
              .update(outboxEvent)
              .set({
                status: "done",
                processedAt: new Date(),
                lastError: "skipped_opt_out",
              })
              .where(eq(outboxEvent.id, event.id));

            processed++;
            return;
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

function extractRecipientUserId(payload: OutboxPayload): string | null {
  if ("recipientUserId" in payload && payload.recipientUserId) {
    return payload.recipientUserId;
  }
  return null;
}
