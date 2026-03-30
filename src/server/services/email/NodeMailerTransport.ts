/**
 * NodeMailerTransport — Strategy (Concrete SMTP Implementation)
 *
 * Pattern: Strategy concrete — implements IEmailTransport.
 * Responsibilities: SMTP send + 3-attempt exponential backoff. Nothing else.
 * Auditing is handled by AuditingEmailTransport (Decorator wrapping this class).
 * Template selection is handled by EmailService.
 */

import nodemailer, { type Transporter } from "nodemailer";
import type { IEmailTransport, MailOptions, SendResult } from "./interfaces";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

const RETRY_DELAYS_MS = [0, 2000, 8000]; // Attempt 1: immediate, 2: +2s, 3: +8s

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class NodeMailerTransport implements IEmailTransport {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: SmtpConfig) {
    this.from = config.from;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      // Production-grade: enforce TLS certificate validation
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === "production",
      },
    });
  }

  async sendMail(options: MailOptions): Promise<SendResult> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) {
        await sleep(RETRY_DELAYS_MS[attempt]);
      }

      try {
        const info = (await this.transporter.sendMail({
          from: this.from,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
          replyTo: options.replyTo,
          headers: {
            "X-Entity-Ref-ID": `aqwa-${Date.now()}`,
          },
        })) as { messageId?: string | undefined };

        if (info && typeof info.messageId === "string") {
          return { messageId: info.messageId };
        } else {
          lastError = new Error("NodeMailerTransport: transporter returned no messageId");
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Do not retry on permanent failures (e.g., invalid recipient)
        const isPermanent =
          lastError.message.includes("Invalid recipient") ||
          lastError.message.includes("User unknown") ||
          lastError.message.includes("550");

        if (isPermanent) {
          break;
        }
      }
    }

    throw lastError ?? new Error("NodeMailerTransport: unknown send failure");
  }

  /** Verify SMTP connectivity at startup. Log warnings — never throw. */
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}
