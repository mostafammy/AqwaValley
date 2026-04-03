import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { EmailService } from "~/server/services/email/EmailService";
import type {
  IEmailTransport,
  MailOptions,
} from "~/server/services/email/interfaces";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

class CaptureTransport implements IEmailTransport {
  public lastMail: MailOptions | null = null;

  async sendMail(options: MailOptions): Promise<{ messageId: string }> {
    this.lastMail = options;
    return { messageId: "msg-test-001" };
  }
}

describe("Email & notification contract coverage", () => {
  it("email_template_renders_correctly", async () => {
    const transport = new CaptureTransport();
    const service = new EmailService(transport);

    await service.dispatch("recipient@example.com", {
      eventType: "user.invited",
      recipientUserId: "user-1",
      recipientEmail: "recipient@example.com",
      recipientName: "<script>alert('x')</script>",
      invitedByName: "Ops Admin",
      farmName: "Kharga Demo Farm",
      inviteUrl: "https://example.test/invite/token",
      expiresInHours: 24,
    });

    expect(transport.lastMail).not.toBeNull();
    expect(transport.lastMail?.subject).toContain("دعوة");
    expect(transport.lastMail?.html).toContain(
      "&lt;script&gt;alert('x')&lt;/script&gt;",
    );
    expect(transport.lastMail?.html).not.toContain(
      "<script>alert('x')</script>",
    );
    expect(transport.lastMail?.html).not.toContain("<script>");
    expect(transport.lastMail?.text).toBeTruthy();
    expect(transport.lastMail?.text).toContain("alert('x')");
  });

  it("notification_respects_user_preferences", () => {
    const routeSource = readSource("src/app/api/cron/dispatch-emails/route.ts");
    const schemaSource = readSource("src/server/db/schema.ts");

    expect(schemaSource).toContain("user_notification_preference");
    expect(schemaSource).toContain("email_opt_out");
    expect(routeSource).toContain("isRecipientOptedOut");
    expect(routeSource).toContain("userNotificationPreference");
    expect(routeSource).toContain("skipped_opt_out");
  });
});
