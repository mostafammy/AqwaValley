/**
 * InvitationValidator — Pure Domain Logic
 *
 * No pattern label — just clean, stateless domain logic.
 * No DB, no network, no side effects.
 * Trivially unit-tested with plain objects.
 *
 * Called by: acceptInvitation, consumeResetToken procedures
 */

export type InvitationValidationResult =
  | { valid: true }
  | {
      valid: false;
      reason: "TOKEN_EXPIRED" | "TOKEN_ALREADY_USED" | "TOKEN_INVALID";
    };

export interface InvitationRecord {
  status: "pending" | "accepted" | "expired" | "revoked";
  expiresAt: Date;
  usedAt: Date | null;
}

export class InvitationValidator {
  /**
   * Validates an invitation/reset token record.
   * Order matters:
   *   1. Status check first (revoked/accepted catch replays immediately)
   *   2. Expiry check second (pending-but-expired tokens)
   *   3. usedAt as secondary one-time-use guard (belt + suspenders)
   */
  validate(invitation: InvitationRecord): InvitationValidationResult {
    if (invitation.status !== "pending") {
      return { valid: false, reason: "TOKEN_ALREADY_USED" };
    }

    if (invitation.expiresAt < new Date()) {
      return { valid: false, reason: "TOKEN_EXPIRED" };
    }

    if (invitation.usedAt !== null) {
      // Belt-and-suspenders: usedAt should coincide with status='accepted',
      // but we guard both independently to survive any inconsistent update.
      return { valid: false, reason: "TOKEN_ALREADY_USED" };
    }

    return { valid: true };
  }
}
