/**
 * EmailService — Strategy Context
 *
 * Pattern: Strategy context — selects template, renders variables,
 * then delegates to IEmailTransport.
 *
 * Responsibilities:
 *   - Template loading + variable interpolation
 *   - Subject line selection (bilingual)
 *   - Delegate to transport
 *
 * Does NOT know which transport is behind the interface (NodeMailer, SES, Null).
 * Does NOT write to email_audit_log — that's AuditingEmailTransport's job.
 */

import fs from "fs";
import path from "path";
import type {
  IEmailTransport,
  MailOptions,
  OutboxPayload,
} from "./interfaces";

// Cache templates in memory after first load (cold start only on first call per type)
const templateCache = new Map<string, string>();

function loadTemplate(name: string): string {
  if (templateCache.has(name)) return templateCache.get(name)!;

  const templatePath = path.join(
    process.cwd(),
    "src",
    "server",
    "services",
    "email",
    "templates",
    `${name}.html`,
  );

  const content = fs.readFileSync(templatePath, "utf-8");
  templateCache.set(name, content);
  return content;
}

/**
 * Simple {{variable}} interpolation without an external dependency.
 * Variables are HTML-escaped to prevent XSS in email clients.
 */
function renderTemplate(
  templateName: string,
  variables: Record<string, string>,
): string {
  let html = loadTemplate(templateName);

  for (const [key, value] of Object.entries(variables)) {
    const escaped = value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), escaped);
  }

  return html;
}

/** Build plain-text fallback by stripping HTML tags */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// Per-event type rendering
// ---------------------------------------------------------------------------

type RenderedEmail = Pick<MailOptions, "subject" | "html" | "text">;

function renderPayload(payload: OutboxPayload): RenderedEmail {
  switch (payload.eventType) {
    case "user.invited": {
      const html = renderTemplate("welcome-invitation", {
        recipientName: payload.recipientName,
        invitedByName: payload.invitedByName,
        farmName: payload.farmName ?? "—",
        inviteUrl: payload.inviteUrl,
        expiresInHours: String(payload.expiresInHours),
      });
      return {
        subject: "مرحباً بك في منظومة أكوا فالي — دعوة تفعيل الحساب",
        html,
        text: htmlToText(html),
      };
    }

    case "password.reset": {
      const html = renderTemplate("password-reset", {
        recipientName: payload.recipientName,
        resetUrl: payload.resetUrl,
        expiresInHours: String(payload.expiresInHours),
        ipRequestedFrom: payload.ipRequestedFrom ?? "غير معروف",
      });
      return {
        subject: "طلب إعادة تعيين كلمة المرور — أكوا فالي",
        html,
        text: htmlToText(html),
      };
    }

    case "farm.scope_granted": {
      const html = renderTemplate("farm-scope-grant", {
        recipientName: payload.recipientName,
        farmName: payload.farmName,
        grantedByName: payload.grantedByName,
        loginUrl: payload.loginUrl,
      });
      return {
        subject: `تم تعيينك مسؤولاً عن المزرعة: ${payload.farmName}`,
        html,
        text: htmlToText(html),
      };
    }

    case "password.changed": {
      const html = renderTemplate("password-changed", {
        recipientName: payload.recipientName,
        changedAt: payload.changedAt,
        ipAddress: payload.ipAddress ?? "غير متاح",
        supportEmail: payload.supportEmail,
      });
      return {
        subject: "تأكيد تغيير كلمة المرور — أكوا فالي",
        html,
        text: htmlToText(html),
      };
    }

    default: {
      const _exhaustive: never = payload;
      throw new Error(
        `EmailService: unhandled event type: ${JSON.stringify(_exhaustive)}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// EmailService class
// ---------------------------------------------------------------------------

export class EmailService {
  constructor(
    private readonly transport: IEmailTransport,
    private readonly defaultFrom = "noreply@aqwavalley.gov.eg",
  ) {}

  async dispatch(
    to: string,
    payload: OutboxPayload,
  ): Promise<{ messageId: string }> {
    const { subject, html, text } = renderPayload(payload);

    return this.transport.sendMail({
      to,
      subject,
      html,
      text,
    });
  }
}
