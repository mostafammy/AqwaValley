/**
 * User Provisioning Service Interfaces — Dependency Inversion Principle
 *
 * Every collaborator injected into UserProvisioningOrchestrator is typed by
 * an interface, not a concrete class. This enables:
 *   - Isolated unit testing (inject mocks without hitting DB or better-auth)
 *   - Future swapping of implementations (e.g., Lucia for better-auth)
 *   - Clean compile-time verification of the collaboration contract
 */

import type { RawToken } from "../token/RawToken";

// ---------------------------------------------------------------------------
// Shared domain types
// ---------------------------------------------------------------------------

export interface ProvisionUserInput {
  nationalId: string;
  email: string;
  fullName: string;
  phone?: string;
  roleType: "admin" | "district_manager" | "farm_owner" | "farmer" | "auditor";
  farmId?: string;
  districtId?: string;
  actorId: string;
  ipAddress?: string;
}

export type ProvisionResult =
  | { status: "INVITED"; userId: string; invitationId: string }
  | { status: "PENDING_INVITATION"; userId: string; canResend: true }
  | { status: "USER_ALREADY_EXISTS"; userId: string }
  | { status: "USER_EXISTS_NO_INVITE"; userId: string };

export type BulkProvisionItem = ProvisionUserInput;

export interface BulkProvisionResult {
  nationalId: string;
  status: "created" | "skipped" | "failed";
  userId?: string;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Collaborator interfaces (Strategy/Adapter contracts)
// ---------------------------------------------------------------------------

/** Adapter — wraps better-auth createUser. Never call better-auth directly. */
export interface IAuthUserCreator {
  createUser(input: {
    email: string;
    nationalId: string;
    fullName: string;
  }): Promise<{ authUserId: string }>;
}

/** Repository — domain interface over user_invitation table */
export interface IInvitationIssuer {
  issue(input: {
    userId: string;
    tokenType: "invitation" | "password_reset";
    ttlHours: number;
    farmId?: string;
    invitedBy?: string;
    ipAddress?: string;
  }): Promise<{ invitationId: string; token: RawToken }>;

  findByTokenHash(tokenHash: string): Promise<{
    id: string;
    userId: string;
    tokenType: "invitation" | "password_reset";
    status: "pending" | "accepted" | "expired" | "revoked";
    expiresAt: Date;
    usedAt: Date | null;
    farmId: string | null;
  } | null>;

  accept(invitationId: string): Promise<void>;
  revoke(invitationId: string): Promise<void>;
  revokeAllPendingForUser(userId: string): Promise<void>;
}

/** Command — role mutation + audit log, one atomic unit */
export interface IRoleAssigner {
  assign(input: {
    userId: string;
    roleType:
      | "admin"
      | "district_manager"
      | "farm_owner"
      | "farmer"
      | "auditor";
    actorId: string;
    ipAddress?: string;
  }): Promise<{ roleId: string }>;

  revoke(input: {
    userId: string;
    roleType:
      | "admin"
      | "district_manager"
      | "farm_owner"
      | "farmer"
      | "auditor";
    actorId: string;
    ipAddress?: string;
  }): Promise<void>;
}

/** Command — farm assignment + audit log, one atomic unit */
export interface IFarmScopeAssigner {
  assign(input: {
    userId: string;
    farmId: string;
    actorId: string;
    ipAddress?: string;
  }): Promise<void>;
}

/** Producer — inserts outbox_event rows inside the DB transaction */
export interface IOutboxEnqueuer {
  enqueue(input: {
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<{ eventId: string }>;
}

/** Observer — invalidates sessions immediately on role revocation */
export interface ISessionInvalidator {
  revokeAllSessions(userId: string): Promise<void>;
}

/** Top-level orchestrator interface */
export interface IUserProvisioningOrchestrator {
  provision(input: ProvisionUserInput): Promise<ProvisionResult>;
  bulkProvision(items: BulkProvisionItem[]): Promise<BulkProvisionResult[]>;
}
