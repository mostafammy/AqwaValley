/**
 * Email Infrastructure Interfaces — Strategy Pattern
 *
 * IEmailTransport defines the seam between EmailService (business logic)
 * and the concrete transport (NodeMailer, SES, NullTransport for tests).
 *
 * EmailService depends on IEmailTransport — never on any concrete class.
 * To swap providers: implement IEmailTransport, change one DI line. Done.
 */

// ---------------------------------------------------------------------------
// Transport interface (Strategy contract)
// ---------------------------------------------------------------------------

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  /** Plain-text fallback for non-HTML clients */
  text?: string;
  /** Reply-to address override */
  replyTo?: string;
}

export interface SendResult {
  /** Provider message ID for email_audit_log.providerMessageId tracing */
  messageId: string;
}

/** Strategy interface — implemented by NodeMailerTransport, NullTransport, SESTransport */
export interface IEmailTransport {
  sendMail(options: MailOptions): Promise<SendResult>;
}

// ---------------------------------------------------------------------------
// Outbox payload types (typed payloads stored in outbox_event.payload JSON)
// ---------------------------------------------------------------------------

export interface WelcomeInvitationPayload {
  eventType: "user.invited";
  recipientUserId: string;
  recipientEmail: string;
  recipientName: string;
  invitedByName: string;
  farmName?: string;
  inviteUrl: string;
  expiresInHours: number;
}

export interface PasswordResetPayload {
  eventType: "password.reset";
  recipientUserId: string;
  recipientEmail: string;
  recipientName: string;
  resetUrl: string;
  expiresInHours: number;
  ipRequestedFrom?: string;
}

export interface FarmScopeGrantPayload {
  eventType: "farm.scope_granted";
  recipientUserId: string;
  recipientEmail: string;
  recipientName: string;
  farmName: string;
  grantedByName: string;
  loginUrl: string;
}

export interface PasswordChangedPayload {
  eventType: "password.changed";
  recipientUserId: string;
  recipientEmail: string;
  recipientName: string;
  changedAt: string; // ISO string
  ipAddress?: string;
  supportEmail: string;
}

export type OutboxPayload =
  | WelcomeInvitationPayload
  | PasswordResetPayload
  | FarmScopeGrantPayload
  | PasswordChangedPayload;
