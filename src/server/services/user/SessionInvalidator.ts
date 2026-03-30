/**
 * SessionInvalidator — Observer Side-Effect Pattern
 *
 * Pattern: Observer — fires synchronously as a side-effect of role changes.
 * Called by: RoleAssigner.revoke(), deactivate mutation, assignRole (downgrade case).
 *
 * The key correctness guarantee:
 *   Without this, a revoked GOV_ADMIN retains their role in-session for up to 7 days.
 *   This observer closes that window completely — sessions are killed immediately
 *   on role revocation, forcing re-login at which point the role is no longer present.
 *
 * Design note: This fires synchronously (no queue) because a security revocation
 * that delays effect is not a revocation — it is a scheduled permission.
 */

import { eq } from "drizzle-orm";
import type { DrizzleDB } from "~/server/db/index";
import { session } from "~/server/db/schema";
import type { ISessionInvalidator } from "./interfaces";

export class SessionInvalidator implements ISessionInvalidator {
  constructor(private readonly db: DrizzleDB) {}

  /**
   * Revokes ALL active sessions for the given user ID.
   * User is forced to re-login immediately.
   * On next login, roles are re-loaded from DB — the revoked role is gone.
   */
  async revokeAllSessions(userId: string): Promise<void> {
    try {
      await this.db.delete(session).where(eq(session.userId, userId));
    } catch (err) {
      // Log but do not throw — session revocation failure is recoverable.
      // The role IS revoked in DB (RoleAssigner committed first).
      // The user's next request will re-load roles from DB and find the role gone.
      console.error(
        `[SessionInvalidator] Failed to revoke sessions for user ${userId}:`,
        err,
      );
    }
  }
}
