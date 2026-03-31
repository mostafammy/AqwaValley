/**
 * InvitationIssuer — Repository Pattern
 *
 * Pattern: Repository — domain interface over user_invitation Drizzle SQL.
 * The orchestrator thinks in domain terms (issue, findByTokenHash, accept, revoke).
 * It never sees raw Drizzle queries.
 *
 * All token generation uses RawToken (Value Object):
 *   - token.hash() → stored in DB (SHA-256 hex)
 *   - token itself → returned to caller for embedding in email URL
 *   - token.raw is NEVER accessible outside RawToken — compiler enforced
 */

import { and, eq, lt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { DBConnection } from "~/server/db/index";
import { userInvitation } from "~/server/db/schema";
import { RawToken } from "../token/RawToken";
import type { IInvitationIssuer } from "./interfaces";

export class InvitationIssuer implements IInvitationIssuer {
  constructor(private readonly db: DBConnection) {}

  async issue(
    input: {
      userId: string;
      tokenType: "invitation" | "password_reset";
      ttlHours: number;
      farmId?: string;
      invitedBy?: string;
      ipAddress?: string;
    },
    tx?: DBConnection,
  ): Promise<{ invitationId: string; token: RawToken }> {
    const token = RawToken.generate();
    const expiresAt = new Date(Date.now() + input.ttlHours * 60 * 60 * 1000);
    const db = tx ?? this.db;

    const [row] = await db
      .insert(userInvitation)
      .values({
        tokenType: input.tokenType,
        tokenHash: token.hash(), // ← SHA-256 only. raw never stored.
        userId: input.userId,
        invitedBy: input.invitedBy ?? null,
        farmId: input.farmId ?? null,
        status: "pending",
        expiresAt,
        ipRequestedFrom: input.ipAddress ?? null,
      })
      .returning({ id: userInvitation.id });

    if (!row?.id) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "InvitationIssuer: failed to create invitation record",
      });
    }

    return { invitationId: row.id, token };
  }

  async findByTokenHash(tokenHash: string, tx?: DBConnection) {
    const db = tx ?? this.db;
    const row = await db.query.userInvitation.findFirst({
      where: eq(userInvitation.tokenHash, tokenHash),
      columns: {
        id: true,
        userId: true,
        tokenType: true,
        status: true,
        expiresAt: true,
        usedAt: true,
        farmId: true,
      },
    });

    return row ?? null;
  }

  async accept(invitationId: string, tx?: DBConnection): Promise<void> {
    const db = tx ?? this.db;
    await db
      .update(userInvitation)
      .set({ status: "accepted", usedAt: new Date() })
      .where(eq(userInvitation.id, invitationId));
  }

  async revoke(invitationId: string, tx?: DBConnection): Promise<void> {
    const db = tx ?? this.db;
    await db
      .update(userInvitation)
      .set({ status: "revoked" })
      .where(eq(userInvitation.id, invitationId));
  }

  async revokeAllPendingForUser(userId: string, tx?: DBConnection): Promise<void> {
    const db = tx ?? this.db;
    await db
      .update(userInvitation)
      .set({ status: "revoked" })
      .where(
        and(
          eq(userInvitation.userId, userId),
          eq(userInvitation.status, "pending"),
        ),
      );
  }

  /** Cleanup: expire tokens past their TTL (called by maintenance cron) */
  async expireStale(): Promise<number> {
    const result = await this.db
      .update(userInvitation)
      .set({ status: "expired" })
      .where(
        and(
          eq(userInvitation.status, "pending"),
          lt(userInvitation.expiresAt, new Date()),
        ),
      )
      .returning({ id: userInvitation.id });

    return result.length;
  }
}
