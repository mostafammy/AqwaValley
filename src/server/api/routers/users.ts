/**
 * users.ts — Facade Pattern (tRPC Router)
 *
 * Pattern: Facade — pure translation layer.
 * Responsibilities: Zod validation + call orchestrator/services + return result.
 * ZERO business logic. ZERO db.insert() calls. ZERO db.update() calls.
 *
 * If you find raw Drizzle queries in this file → it is a violation.
 * Move it to the appropriate service collaborator immediately.
 *
 * Every procedure delegates to a service that owns the concern.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createHash } from "crypto";
import bcryptjs from "bcryptjs";

import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import {
  account,
  auditLog,
  role,
  user,
  userInvitation,
  userProfile,
  userRoleAssignment,
  session,
} from "~/server/db/schema";
import { env } from "~/env";

// Service layer imports
import { AuthUserCreator } from "~/server/services/user/AuthUserCreator";
import { InvitationIssuer } from "~/server/services/user/InvitationIssuer";
import { RoleAssigner } from "~/server/services/user/RoleAssigner";
import { FarmScopeAssigner } from "~/server/services/user/FarmScopeAssigner";
import { OutboxEnqueuer } from "~/server/services/user/OutboxEnqueuer";
import { SessionInvalidator } from "~/server/services/user/SessionInvalidator";
import { UserProvisioningOrchestrator } from "~/server/services/user/UserProvisioningOrchestrator";
import { InvitationValidator } from "~/server/services/token/InvitationValidator";

// ---------------------------------------------------------------------------
// Shared validators
// ---------------------------------------------------------------------------

const roleTypeValues = [
  "admin",
  "district_manager",
  "farm_owner",
  "farmer",
  "auditor",
] as const;

const nationalIdSchema = z
  .string()
  .min(10, "National ID must be at least 10 digits")
  .max(20, "National ID must be at most 20 digits")
  .regex(/^\d+$/, "National ID must contain only digits");

const provisionInputSchema = z.object({
  nationalId: nationalIdSchema,
  email: z.string().email(),
  fullName: z.string().min(2).max(255),
  phone: z.string().optional(),
  roleType: z.enum(roleTypeValues),
  farmId: z.string().uuid().optional(),
  districtId: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// In-memory rate limiter (sufficient at ~1,550 user scale)
// ---------------------------------------------------------------------------

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}

import type { DrizzleDB } from "~/server/db";

// ---------------------------------------------------------------------------
// Helper: build orchestrator from db context (Facade composes services)
// ---------------------------------------------------------------------------

function buildOrchestrator(db: DrizzleDB): UserProvisioningOrchestrator {
  const authUserCreator = new AuthUserCreator();
  const invitationIssuer = new InvitationIssuer(db);
  const roleAssigner = new RoleAssigner(db);
  const farmScopeAssigner = new FarmScopeAssigner(db);
  const outboxEnqueuer = new OutboxEnqueuer(db);
  const sessionInvalidator = new SessionInvalidator(db);

  return new UserProvisioningOrchestrator(
    db,
    authUserCreator,
    invitationIssuer,
    roleAssigner,
    farmScopeAssigner,
    outboxEnqueuer,
    sessionInvalidator,
  );
}

// ---------------------------------------------------------------------------
// Router (Facade)
// ---------------------------------------------------------------------------

export const usersRouter = createTRPCRouter({
  // ============================================================
  // PROVISIONING
  // ============================================================

  /**
   * createAndInvite — idempotent single-user provisioning.
   * Returns discriminated union (INVITED | PENDING_INVITATION | USER_ALREADY_EXISTS | USER_EXISTS_NO_INVITE).
   */
  createAndInvite: adminProcedure
    .input(provisionInputSchema)
    .mutation(async ({ ctx, input }) => {
      const orchestrator = buildOrchestrator(ctx.db);
      return orchestrator.provision({
        ...input,
        actorId: ctx.session.user.id,
        ipAddress: ctx.headers.get("x-forwarded-for") ?? undefined,
      });
    }),

  /**
   * bulkProvision — batch provisioning, max 50 per call.
   * Uses Promise.allSettled — individual failures don't abort the batch.
   */
  bulkProvision: adminProcedure
    .input(
      z.object({
        users: z
          .array(provisionInputSchema)
          .min(1)
          .max(50, "Maximum 50 users per bulk provision call"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orchestrator = buildOrchestrator(ctx.db);
      return orchestrator.bulkProvision(
        input.users.map((u) => ({
          ...u,
          actorId: ctx.session.user.id,
          ipAddress: ctx.headers.get("x-forwarded-for") ?? undefined,
        })),
      );
    }),

  /**
   * resendInvitation — revoke current pending invite, issue new one and re-enqueue.
   */
  resendInvitation: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const issuer = new InvitationIssuer(ctx.db);
      const enqueuer = new OutboxEnqueuer(ctx.db);

      // Revoke all pending invites for this user
      await issuer.revokeAllPendingForUser(input.userId);

      // Fetch user info for the new email
      const userRecord = await ctx.db.query.user.findFirst({
        where: eq(user.id, input.userId),
        columns: { email: true, name: true },
      });

      if (!userRecord) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      // Issue new invitation
      const { invitationId, token } = await issuer.issue({
        userId: input.userId,
        tokenType: "invitation",
        ttlHours: env.INVITATION_TOKEN_TTL_HOURS,
        invitedBy: ctx.session.user.id,
      });

      // Enqueue via outbox
      await enqueuer.enqueue({
        eventType: "user.invited",
        payload: {
          eventType: "user.invited",
          recipientUserId: input.userId,
          recipientEmail: userRecord.email,
          recipientName: userRecord.name,
          invitedByName: ctx.session.user.name ?? "Admin",
          inviteUrl: token.toEmailUrl(env.APP_URL),
          expiresInHours: env.INVITATION_TOKEN_TTL_HOURS,
        },
      });

      return { invitationId, message: "Invitation resent" };
    }),

  /**
   * revokeInvitation — mark invitation as revoked.
   */
  revokeInvitation: adminProcedure
    .input(z.object({ invitationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const issuer = new InvitationIssuer(ctx.db);
      const revoked = await issuer.revoke(input.invitationId);
      if (!revoked) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invitation not pending or not found",
        });
      }

      return { success: true };
    }),

  /**
   * listInvitations — paginated invitation list with filters.
   */
  listInvitations: adminProcedure
    .input(
      z.object({
        status: z
          .enum(["pending", "accepted", "expired", "revoked"])
          .optional(),
        tokenType: z.enum(["invitation", "password_reset"]).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.pageSize;
      const conditions = [];

      if (input.status)
        conditions.push(eq(userInvitation.status, input.status));
      if (input.tokenType)
        conditions.push(eq(userInvitation.tokenType, input.tokenType));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, countResult] = await Promise.all([
        ctx.db.query.userInvitation.findMany({
          where,
          limit: input.pageSize,
          offset,
          orderBy: [desc(userInvitation.createdAt)],
          columns: {
            id: true,
            tokenType: true,
            userId: true,
            status: true,
            expiresAt: true,
            usedAt: true,
            createdAt: true,
          },
        }),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(userInvitation)
          .where(where),
      ]);

      return {
        items,
        total: Number(countResult[0]?.count ?? 0),
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  // ============================================================
  // TOKEN CONSUMPTION (public procedures)
  // ============================================================

  /**
   * validateToken — Used by the UI before showing the Set Password form.
   */
  validateToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      // We look up by checking the hash
      const tokenHash = createHash("sha256").update(input.token).digest("hex");
      const issuer = new InvitationIssuer(ctx.db);

      const invitation = await issuer.findByTokenHash(tokenHash);
      if (!invitation)
        return { valid: false as const, reason: "INVALID_TOKEN" as const };

      const validator = new InvitationValidator();
      const result = validator.validate(invitation);

      if (!result.valid) return result;

      return {
        valid: true as const,
        tokenType: invitation.tokenType, // 'invitation' or 'password_reset'
      };
    }),

  /**
   * acceptInvitation — consumes an invitation token.
   * Validates hash + expiry + one-time-use, sets password, creates session.
   */
  acceptInvitation: publicProcedure
    .input(
      z.object({
        token: z.string().min(64, "Invalid token format"),
        newPassword: z
          .string()
          .min(8, "Password must be at least 8 characters"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tokenHash = createHash("sha256").update(input.token).digest("hex");
      const issuer = new InvitationIssuer(ctx.db);
      const validator = new InvitationValidator();

      // Repository lookup by hash
      const invitation = await issuer.findByTokenHash(tokenHash);

      if (!invitation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "TOKEN_INVALID" });
      }

      // Pure domain validation (no DB)
      const validation = validator.validate(invitation);
      if (!validation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: validation.reason,
        });
      }

      // Compute password hash before touching DB so we don't burn the token
      // if hashing fails. Then perform accept + account update atomically.
      const passwordHash = await bcryptjs.hash(input.newPassword, 12);

      await ctx.db.transaction(async (tx) => {
        // Mark consumed (one-time-use enforced) inside the same transaction
        const accepted = await issuer.accept(invitation.id, tx);
        if (!accepted) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Invitation already consumed or not pending",
          });
        }

        // Update account password; ensure a row was affected so we can
        // surface an error and rollback the accept if not.
        const updated = await tx
          .update(account)
          .set({ password: passwordHash })
          .where(eq(account.userId, invitation.userId))
          .returning({ id: account.id });

        if (!Array.isArray(updated) || updated.length === 0) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update account password",
          });
        }
      });

      // We lookup the user to return the email for the client to perform a seamless auto sign-in
      const userRecord = await ctx.db.query.user.findFirst({
        where: eq(user.id, invitation.userId),
        columns: { email: true },
      });

      return {
        success: true,
        message: "Account activated. Please sign in.",
        email: userRecord?.email,
      };
    }),

  /**
   * consumeResetToken — consumes a password reset token.
   * Enumeration-safe: same response shape regardless of token validity.
   */
  consumeResetToken: publicProcedure
    .input(
      z.object({
        token: z.string().min(64),
        newPassword: z.string().min(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tokenHash = createHash("sha256").update(input.token).digest("hex");
      const issuer = new InvitationIssuer(ctx.db);
      const validator = new InvitationValidator();
      const enqueuer = new OutboxEnqueuer(ctx.db);

      const invitation = await issuer.findByTokenHash(tokenHash);

      if (!invitation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "TOKEN_INVALID" });
      }

      const validation = validator.validate(invitation);
      if (!validation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: validation.reason,
        });
      }

      // Hash password before any DB side-effects
      const passwordHash = await bcryptjs.hash(input.newPassword, 12);

      await ctx.db.transaction(async (tx) => {
        const accepted = await issuer.accept(invitation.id, tx);
        if (!accepted) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Token already consumed or not pending",
          });
        }

        const updated = await tx
          .update(account)
          .set({ password: passwordHash })
          .where(eq(account.userId, invitation.userId))
          .returning({ id: account.id });

        if (!Array.isArray(updated) || updated.length === 0) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update account password",
          });
        }
      });

      // Fetch user for confirmation email
      const userRecord = await ctx.db.query.user.findFirst({
        where: eq(user.id, invitation.userId),
        columns: { email: true, name: true },
      });

      if (userRecord) {
        // Enqueue confirmation email via outbox
        await enqueuer.enqueue({
          eventType: "password.changed",
          payload: {
            eventType: "password.changed",
            recipientUserId: invitation.userId,
            recipientEmail: userRecord.email,
            recipientName: userRecord.name,
            changedAt: new Date().toISOString(),
            supportEmail: "support@aqwavalley.gov.eg",
          },
        });
      }

      return {
        success: true,
        message: "Password updated. Please sign in.",
        email: userRecord?.email,
      };
    }),

  // ============================================================
  // PASSWORD RESET (Enumeration-safe)
  // ============================================================

  /**
   * selfRequestPasswordReset — public endpoint with enumeration-safe response.
   * Rate-limited: 3/hr per userId, 5/15min per IP.
   * ALWAYS returns the same message — never confirms whether account exists.
   */
  selfRequestPasswordReset: publicProcedure
    .input(
      z.object({
        nationalId: nationalIdSchema,
        email: z.string().email(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const CONSTANT_RESPONSE = {
        success: true,
        message:
          "إذا كان الحساب موجوداً، سيتم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني.",
      };

      const ip = ctx.headers.get("x-forwarded-for") ?? "unknown";

      // IP rate limit: 5 requests per 15 minutes
      const ipKey = `reset_ip:${ip}`;
      if (!checkRateLimit(ipKey, 5, 15 * 60 * 1000)) {
        return CONSTANT_RESPONSE; // Enumeration-safe: same response on rate limit
      }

      // Lookup user — silently abort if not found (enumeration-safe)
      const userRecord = await ctx.db.query.user.findFirst({
        where: eq(user.username, input.nationalId),
        columns: { id: true, email: true, name: true },
      });

      if (userRecord?.email !== input.email) {
        return CONSTANT_RESPONSE;
      }

      // Per-user rate limit: 3/hr
      const userKey = `reset_user:${userRecord.id}`;
      if (!checkRateLimit(userKey, 3, 60 * 60 * 1000)) {
        return CONSTANT_RESPONSE;
      }

      // Issue reset token and enqueue email
      const issuer = new InvitationIssuer(ctx.db);
      const enqueuer = new OutboxEnqueuer(ctx.db);

      const { token } = await issuer.issue({
        userId: userRecord.id,
        tokenType: "password_reset",
        ttlHours: env.RESET_TOKEN_TTL_HOURS,
        ipAddress: ip,
      });

      await enqueuer.enqueue({
        eventType: "password.reset",
        payload: {
          eventType: "password.reset",
          recipientUserId: userRecord.id,
          recipientEmail: userRecord.email,
          recipientName: userRecord.name,
          resetUrl: token.toResetUrl(env.APP_URL),
          expiresInHours: env.RESET_TOKEN_TTL_HOURS,
          ipRequestedFrom: ip,
        },
      });

      return CONSTANT_RESPONSE;
    }),

  /**
   * triggerPasswordReset — admin-initiated reset for any user.
   */
  triggerPasswordReset: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const issuer = new InvitationIssuer(ctx.db);
      const enqueuer = new OutboxEnqueuer(ctx.db);

      const userRecord = await ctx.db.query.user.findFirst({
        where: eq(user.id, input.userId),
        columns: { email: true, name: true },
      });

      if (!userRecord) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const { token } = await issuer.issue({
        userId: input.userId,
        tokenType: "password_reset",
        ttlHours: env.RESET_TOKEN_TTL_HOURS,
        invitedBy: ctx.session.user.id,
      });

      await enqueuer.enqueue({
        eventType: "password.reset",
        payload: {
          eventType: "password.reset",
          recipientUserId: input.userId,
          recipientEmail: userRecord.email,
          recipientName: userRecord.name,
          resetUrl: token.toResetUrl(env.APP_URL),
          expiresInHours: env.RESET_TOKEN_TTL_HOURS,
        },
      });

      return { success: true };
    }),

  // ============================================================
  // ROLE & FARM MANAGEMENT (Command pattern via services)
  // ============================================================

  /**
   * assignRole — Command pattern: assigns role + writes audit_log.
   */
  assignRole: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        roleType: z.enum(roleTypeValues),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const assigner = new RoleAssigner(ctx.db);
      return assigner.assign({
        userId: input.userId,
        roleType: input.roleType,
        actorId: ctx.session.user.id,
        ipAddress: ctx.headers.get("x-forwarded-for") ?? undefined,
      });
    }),

  /**
   * revokeRole — Command + Observer: revokes role + writes audit_log + revokes sessions.
   */
  revokeRole: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        roleType: z.enum(roleTypeValues),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orchestrator = buildOrchestrator(ctx.db);
      await orchestrator.revokeRole({
        userId: input.userId,
        roleType: input.roleType,
        actorId: ctx.session.user.id,
        ipAddress: ctx.headers.get("x-forwarded-for") ?? undefined,
      });
      return { success: true };
    }),

  /**
   * assignFarm — Command pattern: sets farm.farmerUserId + audit_log + queues email.
   */
  assignFarm: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        farmId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const farmAssigner = new FarmScopeAssigner(ctx.db);
      const enqueuer = new OutboxEnqueuer(ctx.db);

      await farmAssigner.assign({
        userId: input.userId,
        farmId: input.farmId,
        actorId: ctx.session.user.id,
        ipAddress: ctx.headers.get("x-forwarded-for") ?? undefined,
      });

      const farmName = await farmAssigner.getFarmName(input.farmId);
      const userRecord = await ctx.db.query.user.findFirst({
        where: eq(user.id, input.userId),
        columns: { email: true, name: true },
      });

      if (userRecord) {
        await enqueuer.enqueue({
          eventType: "farm.scope_granted",
          payload: {
            eventType: "farm.scope_granted",
            recipientUserId: input.userId,
            recipientEmail: userRecord.email,
            recipientName: userRecord.name,
            farmName,
            grantedByName: ctx.session.user.name ?? "Admin",
            loginUrl: env.APP_URL,
          },
        });
      }

      return { success: true };
    }),

  // ============================================================
  // EXISTING PRESERVED PROCEDURES (Unchanged per PRD)
  // ============================================================

  /**
   * listByDistrict — paginated user listing for a district.
   */
  listByDistrict: adminProcedure
    .input(
      z.object({
        districtId: z.string().uuid(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.pageSize;

      const [items, countResult] = await Promise.all([
        ctx.db
          .select({
            userId: userProfile.userId,
            nationalId: userProfile.nationalId,
            fullName: userProfile.fullName,
            phoneNumber: userProfile.phoneNumber,
            isActive: userProfile.isActive,
            createdAt: userProfile.createdAt,
          })
          .from(userProfile)
          .where(eq(userProfile.districtId, input.districtId))
          .limit(input.pageSize)
          .offset(offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(userProfile)
          .where(eq(userProfile.districtId, input.districtId)),
      ]);

      return {
        items,
        total: Number(countResult[0]?.count ?? 0),
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  /**
   * getRoles — get a user's current role assignments.
   */
  getRoles: adminProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          assignmentId: userRoleAssignment.id,
          roleType: role.type,
          roleDisplayName: role.displayName,
          assignedAt: userRoleAssignment.assignedAt,
        })
        .from(userRoleAssignment)
        .innerJoin(role, eq(userRoleAssignment.roleId, role.id))
        .where(eq(userRoleAssignment.userId, input.userId));
    }),

  /**
   * getProfile — fetch own profile.
   */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.userProfile.findFirst({
      where: eq(userProfile.userId, ctx.session.user.id),
    });
  }),

  /**
   * updateProfile — update own name / phone.
   */
  updateProfile: protectedProcedure
    .input(
      z.object({
        fullName: z.string().min(2).max(255).optional(),
        phone: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(userProfile)
        .set({
          fullName: input.fullName,
          phoneNumber: input.phone,
          updatedAt: new Date(),
        })
        .where(eq(userProfile.userId, ctx.session.user.id));

      return { success: true };
    }),

  /**
   * deactivate — deactivates a user: profile, pending invites, sessions all revoked.
   */
  deactivate: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const issuer = new InvitationIssuer(ctx.db);

      await ctx.db.transaction(async (tx) => {
        // Deactivate profile
        await tx
          .update(userProfile)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(userProfile.userId, input.userId));

        // Write audit log for deactivation
        await tx.insert(auditLog).values({
          entityType: "user_deactivation",
          entityId: input.userId,
          actorId: ctx.session.user.id,
          before: { isActive: true },
          after: { isActive: false },
          ipAddress: ctx.headers.get("x-forwarded-for") ?? null,
        });

        // Revoke all pending invitations inside the same transaction so token
        // state and deactivation are atomic.
        await issuer.revokeAllPendingForUser(input.userId, tx);

        // Revoke sessions inside the transaction so revoked users cannot have
        // active sessions after the deactivation commit.
        await tx.delete(session).where(eq(session.userId, input.userId));
      });

      return { success: true };
    }),

  /**
   * getAuditLog — paginated audit trail for a user.
   */
  getAuditLog: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.pageSize;

      const [items, countResult] = await Promise.all([
        ctx.db.query.auditLog.findMany({
          where: eq(auditLog.entityId, input.userId),
          limit: input.pageSize,
          offset,
          orderBy: [desc(auditLog.createdAt)],
        }),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(auditLog)
          .where(eq(auditLog.entityId, input.userId)),
      ]);

      return {
        items,
        total: Number(countResult[0]?.count ?? 0),
        page: input.page,
        pageSize: input.pageSize,
      };
    }),
});
