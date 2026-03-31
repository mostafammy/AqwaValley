/**
 * NullTransport — Null Object Pattern
 *
 * Pattern: Null Object — implements IEmailTransport interface.
 * Use in: test suites, CI environments, local development without SMTP.
 *
 * Properties:
 *   - Never hits a real SMTP server
 *   - Never fails on missing credentials
 *   - Returns a predictable fake messageId for assertion in tests
 *   - Optionally collects sent messages for inspection in tests
 *
 * Inject via the same IEmailTransport boundary — zero test-specific code elsewhere.
 */

import type { IEmailTransport, MailOptions, SendResult } from "./interfaces";

export interface CapturedEmail {
  to: string;
  subject: string;
  html: string;
  text?: string;
  sentAt: Date;
}

export class NullTransport implements IEmailTransport {
  /** Captures sent emails for test assertions. */
  public readonly sent: CapturedEmail[] = [];

  async sendMail(options: MailOptions): Promise<SendResult> {
    const captured: CapturedEmail = {
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      sentAt: new Date(),
    };

    this.sent.push(captured);

    return {
      messageId: `null-transport-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
  }

  /** Convenience: assert one email was sent to a specific recipient */
  findSentTo(email: string): CapturedEmail | undefined {
    return this.sent.find((m) => m.to === email);
  }

  /** Reset captured emails between test cases */
  clear(): void {
    this.sent.length = 0;
  }
}
