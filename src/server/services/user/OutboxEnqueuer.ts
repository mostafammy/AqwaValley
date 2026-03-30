/**
 * OutboxEnqueuer — Producer / Transactional Outbox Pattern
 *
 * Pattern: Producer — inserts outbox_event rows INSIDE the DB transaction.
 * This is called by UserProvisioningOrchestrator as the LAST step in the tx.
 *
 * The critical property:
 *   - User created  ✓  (auth record + profile + role + farm)
 *   - Email queued  ✓  (outbox row committed in same tx)
 *   - Server crashes AFTER commit → outbox row survives, cron picks it up
 *   - Email provider down → user still created, email retries on recovery
 *   - Exactly-once delivery guarantee via processed_at timestamp
 *
 * The cron at /api/cron/dispatch-emails reads pending outbox rows and
 * dispatches them via EmailService, incrementing attempts on failure,
 * dead-lettering at maxAttempts.
 */

import { TRPCError } from "@trpc/server";
import type { DrizzleDB } from "~/server/db/index";
import { outboxEvent } from "~/server/db/schema";
import type { IOutboxEnqueuer } from "./interfaces";

// Re-export OutboxPayload for use in callers
import type { OutboxPayload } from "../email/interfaces";
export type { OutboxPayload };

export class OutboxEnqueuer implements IOutboxEnqueuer {
  constructor(private readonly db: DrizzleDB) {}

  async enqueue(input: {
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<{ eventId: string }> {
    const [row] = await this.db
      .insert(outboxEvent)
      .values({
        eventType: input.eventType,
        payload: input.payload,
        status: "pending",
        attempts: 0,
        maxAttempts: 5,
      })
      .returning({ id: outboxEvent.id });

    if (!row?.id) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "OutboxEnqueuer: failed to insert outbox_event row",
      });
    }

    return { eventId: row.id };
  }

  /**
   * Enqueue a typed outbox payload. Validates the event type at compile time.
   * Use this in application code — enqueue() is the raw version for flexibility.
   */
  async enqueueTyped(payload: OutboxPayload): Promise<{ eventId: string }> {
    return this.enqueue({
      eventType: payload.eventType,
      payload: payload as unknown as Record<string, unknown>,
    });
  }
}
