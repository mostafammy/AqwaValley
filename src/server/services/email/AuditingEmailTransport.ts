/**
 * AuditingEmailTransport — Decorator Pattern
 *
 * Pattern: Decorator — wraps any IEmailTransport.
 * Responsibilities:
 *   1. Insert email_audit_log row (status: 'queued') before send
 *   2. Call inner.sendMail(opts)
 *   3. Update email_audit_log row with result (status: 'sent' | 'failed')
 *
 * The wrapped transport has NO IDEA it is being audited.
 * EmailService has NO IDEA the audit record exists.
 * Audit concern is fully separated from send concern.
 *
 * Stackable: AuditingEmailTransport(RetryTransport(NodeMailerTransport()))
 *
 * NOTE: This decorator is used by EmailService at dispatch time (cron route).
 * The email_audit_log row is the legally defensible delivery attempt record.
 */

import type { DrizzleDB } from "~/server/db";
import { emailAuditLog } from "~/server/db/schema";
import type { IEmailTransport, MailOptions, SendResult } from "./interfaces";
import type { emailTypeEnum } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "~/lib/logger";

type EmailType = (typeof emailTypeEnum.enumValues)[number];

export interface AuditedMailOptions extends MailOptions {
  /** Required for the audit record to link email type */
  emailType: EmailType;
  /** Optional: user ID of the recipient for the audit log */
  recipientUserId?: string;
  /** Optional: IP address that triggered the send */
  ipRequestedFrom?: string;
}

export class AuditingEmailTransport implements IEmailTransport {
  constructor(
    private readonly inner: IEmailTransport,
    private readonly db: DrizzleDB,
  ) {}

  async sendMail(options: AuditedMailOptions): Promise<SendResult> {
    // 1. Pre-send: insert audit row in 'queued' state
    const [auditRow] = await this.db
      .insert(emailAuditLog)
      .values({
        recipientEmail: options.to,
        recipientUserId: options.recipientUserId ?? null,
        emailType: options.emailType,
        status: "queued",
        ipRequestedFrom: options.ipRequestedFrom ?? null,
      })
      .returning({ id: emailAuditLog.id });

    const auditId = auditRow!.id;

    // 2. Send via inner transport
    try {
      const result = await this.inner.sendMail(options);

      // 3a. Success: attempt to update audit row with messageId and 'sent' status.
      // If the DB update fails, log it but do NOT rethrow — the send succeeded
      // and callers should receive the successful SendResult.
      try {
        await this.db
          .update(emailAuditLog)
          .set({
            status: "sent",
            providerMessageId: result.messageId,
          })
          .where(eq(emailAuditLog.id, auditId));
      } catch (auditErr) {
        logger.error(
          { err: auditErr, auditId, to: options.to },
          "email.audit.update_failed_on_success",
        );
        // Optionally: push to a retry queue or record a non-fatal metric here.
      }

      return result;
    } catch (err) {
      // 3b. Failure: update audit row with error detail. If updating the audit
      // row fails, log that error but rethrow the original send error so
      // upstream retry semantics remain based on the send failure.
      const errorDetail = err instanceof Error ? err.message : "Unknown send error";

      try {
        await this.db
          .update(emailAuditLog)
          .set({
            status: "failed",
            errorDetail,
          })
          .where(eq(emailAuditLog.id, auditId));
      } catch (auditErr) {
        logger.error(
          { err: auditErr, auditId, to: options.to },
          "email.audit.update_failed_on_error",
        );
      }

      throw err;
    }
  }
}
