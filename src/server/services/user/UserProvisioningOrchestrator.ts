/**
 * UserProvisioningOrchestrator — Mediator Pattern
 *
 * Pattern: Mediator — the centrepiece of the system.
 * Knows WHAT to do and IN WHAT ORDER. Never knows HOW anything works.
 * Holds references to collaborators via constructor injection (DIP).
 *
 * Sub-services are fully decoupled from each other:
 *   RoleAssigner has no idea InvitationIssuer exists.
 *   InvitationIssuer has no idea FarmScopeAssigner exists.
 *
 * To add a new step (e.g., district-assignment):
 *   → Add IDistrictAssigner to constructor
 *   → Call it in the correct position in provision()
 *   → Zero changes to any existing sub-service
 *
 * Idempotency contract (createAndInvite / provision):
 *   USER_ALREADY_EXISTS    → duplicate nationalId, accepted invite
 *   PENDING_INVITATION     → duplicate nationalId, pending invite (canResend)
 *   USER_EXISTS_NO_INVITE  → legacy user, no invite record
 *   INVITED                → full provisioning succeeded
 */

import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { DrizzleDB } from "~/server/db/index";
import { user, userInvitation, userProfile } from "~/server/db/schema";
import { env } from "~/env";
import type {
  BulkProvisionItem,
  BulkProvisionResult,
  IAuthUserCreator,
  IFarmScopeAssigner,
  IInvitationIssuer,
  IOutboxEnqueuer,
  IRoleAssigner,
  ISessionInvalidator,
  IUserProvisioningOrchestrator,
  ProvisionResult,
  ProvisionUserInput,
} from "./interfaces";

export class UserProvisioningOrchestrator
  implements IUserProvisioningOrchestrator
{
  constructor(
    private readonly db: DrizzleDB,
    private readonly authUserCreator: IAuthUserCreator,
    private readonly invitationIssuer: IInvitationIssuer,
    private readonly roleAssigner: IRoleAssigner,
    private readonly farmScopeAssigner: IFarmScopeAssigner,
    private readonly outboxEnqueuer: IOutboxEnqueuer,
    private readonly sessionInvalidator: ISessionInvalidator,
  ) {}

  // ---------------------------------------------------------------------------
  // provision() — idempotent single-user provisioning
  // ---------------------------------------------------------------------------

  async provision(input: ProvisionUserInput): Promise<ProvisionResult> {
    // Pre-flight: check for existing user with this nationalId
    const existingUser = await this.db.query.user.findFirst({
      where: eq(user.username, input.nationalId),
      columns: { id: true },
    });

    if (existingUser) {
      // Check invitation status
      const existingInvitation = await this.db.query.userInvitation.findFirst({
        where: eq(userInvitation.userId, existingUser.id),
        columns: { id: true, status: true },
        orderBy: (inv, { desc }) => [desc(inv.createdAt)],
      });

      if (existingInvitation?.status === "pending") {
        return {
          status: "PENDING_INVITATION",
          userId: existingUser.id,
          canResend: true,
        };
      }

      if (existingInvitation?.status === "accepted") {
        return { status: "USER_ALREADY_EXISTS", userId: existingUser.id };
      }

      return { status: "USER_EXISTS_NO_INVITE", userId: existingUser.id };
    }

    // Full provisioning inside a single DB transaction
    const result = await this.db.transaction(async (tx) => {
      // Step 1: Create auth identity (Adapter — wraps better-auth)
      const { authUserId } = await this.authUserCreator.createUser({
        email: input.email,
        nationalId: input.nationalId,
        fullName: input.fullName,
      });

      // Step 2: Create domain profile
      await tx.insert(userProfile).values({
        userId: authUserId,
        fullName: input.fullName,
        nationalId: input.nationalId,
        phoneNumber: input.phone ?? null,
        districtId: input.districtId ?? null,
        isActive: true,
      });

      // Step 3: Issue invitation token (Repository)
      const { invitationId, token } = await this.invitationIssuer.issue({
        userId: authUserId,
        tokenType: "invitation",
        ttlHours: env.INVITATION_TOKEN_TTL_HOURS,
        farmId: input.farmId,
        invitedBy: input.actorId,
        ipAddress: input.ipAddress,
      });

      // Step 4: Assign role (Command — includes audit_log write)
      await this.roleAssigner.assign({
        userId: authUserId,
        roleType: input.roleType,
        actorId: input.actorId,
        ipAddress: input.ipAddress,
      });

      // Step 5: Assign farm scope if provided (Command — includes audit_log write)
      if (input.farmId) {
        await this.farmScopeAssigner.assign({
          userId: authUserId,
          farmId: input.farmId,
          actorId: input.actorId,
          ipAddress: input.ipAddress,
        });
      }

      // Step 6: Enqueue welcome email via outbox (Producer — inside tx)
      const inviteUrl = token.toEmailUrl(env.APP_URL);
      await this.outboxEnqueuer.enqueue({
        eventType: "user.invited",
        payload: {
          eventType: "user.invited",
          recipientUserId: authUserId,
          recipientEmail: input.email,
          recipientName: input.fullName,
          invitedByName: input.actorId, // Resolved to name in cron if needed
          inviteUrl,
          expiresInHours: env.INVITATION_TOKEN_TTL_HOURS,
        },
      });

      return { authUserId, invitationId };
    });

    return {
      status: "INVITED",
      userId: result.authUserId,
      invitationId: result.invitationId,
    };
  }

  // ---------------------------------------------------------------------------
  // bulkProvision() — processes up to 50 users with Promise.allSettled
  // ---------------------------------------------------------------------------

  async bulkProvision(items: BulkProvisionItem[]): Promise<BulkProvisionResult[]> {
    if (items.length > 50) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "bulkProvision: maximum 50 users per call",
      });
    }

    // Promise.allSettled → individual failures don't abort the batch
    const settlements = await Promise.allSettled(
      items.map((item) => this.provision(item)),
    );

    return settlements.map((settlement, i) => {
      const item = items[i]!;

      if (settlement.status === "fulfilled") {
        const result = settlement.value;
        return {
          nationalId: item.nationalId,
          status:
            result.status === "INVITED" ? "created" : "skipped",
          userId: result.userId,
          reason:
            result.status !== "INVITED" ? result.status : undefined,
        };
      }

      const err = settlement.reason as Error;
      return {
        nationalId: item.nationalId,
        status: "failed" as const,
        reason: err?.message ?? "Unknown error",
      };
    });
  }

  // ---------------------------------------------------------------------------
  // revokeRole() — with immediate session invalidation (Observer)
  // ---------------------------------------------------------------------------

  async revokeRole(input: {
    userId: string;
    roleType: "admin" | "district_manager" | "farm_owner" | "farmer" | "auditor";
    actorId: string;
    ipAddress?: string;
  }): Promise<void> {
    // Command: revoke role + write audit_log
    await this.roleAssigner.revoke(input);

    // Observer: revoke all sessions immediately — no stale-role window
    await this.sessionInvalidator.revokeAllSessions(input.userId);
  }
}
