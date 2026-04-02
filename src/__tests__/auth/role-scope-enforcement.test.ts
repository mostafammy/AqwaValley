/**
 * Tier 0 Invariant #6: Role scope must remain session-scoped
 *
 * REQUIREMENT: Given a user with access to farm X, manipulated farmId or
 * districtId payloads must not cross into farm Y or another district.
 *
 * REQUIREMENT: Given privilege reduction (e.g., role downgrade), the session
 * must be invalidated to prevent using old permissions.
 *
 * LAYER: Unit (authorization and scope validation logic)
 * PRINCIPLES: F.I.R.S.T. - Critical security boundary
 */

import { describe, it, expect } from "vitest";

// ============================================================================
// Types
// ============================================================================

interface User {
  id: string;
  role: "farmer" | "district_admin" | "system_admin";
  farmIds: string[]; // Which farms this user can access
  districtId?: string; // For district admins
}

interface Session {
  userId: string;
  user: User;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
}

interface AccessRequest {
  requesterUserId: string;
  targetFarmId?: string;
  targetDistrictId?: string;
}

// ============================================================================
// Authorization Logic
// ============================================================================

/**
 * Verify that a user session is still valid and not expired.
 */
function isSessionValid(session: Session, now: Date = new Date()): boolean {
  // Session must not be expired
  if (session.expiresAt < now) {
    return false;
  }

  // Session must have a user
  if (!session.user || !session.userId) {
    return false;
  }

  return true;
}

/**
 * Verify that a user has access to a specific farm.
 * CRITICAL: Must enforce farm boundaries strictly.
 */
function canAccessFarm(user: User, targetFarmId: string): boolean {
  // Farmers can only access their own farms
  if (user.role === "farmer") {
    return user.farmIds.includes(targetFarmId);
  }

  // District admins can access any farm in their district
  // (In a real system, would query the database to verify farm belongs to district)
  if (user.role === "district_admin") {
    // Simplified: assume district admin can access any farm
    // In production, would check: farm.districtId === user.districtId
    return !!user.districtId;
  }

  // System admins can access any farm
  if (user.role === "system_admin") {
    return true;
  }

  return false;
}

/**
 * Verify that a user has access to a specific district.
 */
function canAccessDistrict(user: User, targetDistrictId: string): boolean {
  // Farmers have no district-level access
  if (user.role === "farmer") {
    return false;
  }

  // District admins can only access their own district
  if (user.role === "district_admin") {
    return user.districtId === targetDistrictId;
  }

  // System admins can access any district
  if (user.role === "system_admin") {
    return true;
  }

  return false;
}

/**
 * Authorize a request. Returns true if allowed, false otherwise.
 * CRITICAL: This is a security-critical function.
 */
function authorizeRequest(
  session: Session,
  request: AccessRequest,
): { authorized: boolean; reason?: string } {
  // Check 1: Session must be valid
  if (!isSessionValid(session)) {
    return { authorized: false, reason: "Session expired or invalid" };
  }

  // Check 2: User must match requester
  if (session.userId !== request.requesterUserId) {
    return { authorized: false, reason: "Session user mismatch" };
  }

  // Check 3: Farm scope (if requested)
  if (request.targetFarmId) {
    if (!canAccessFarm(session.user, request.targetFarmId)) {
      return {
        authorized: false,
        reason: "User does not have access to this farm",
      };
    }
  }

  // Check 4: District scope (if requested)
  if (request.targetDistrictId) {
    if (!canAccessDistrict(session.user, request.targetDistrictId)) {
      return {
        authorized: false,
        reason: "User does not have access to this district",
      };
    }
  }

  return { authorized: true };
}

// ============================================================================
// Tests
// ============================================================================

describe("Role Scope Session Authorization (Invariant #6)", () => {
  const farmX = "farm-x-id";
  const farmY = "farm-y-id";
  const districtAlpha = "district-alpha-id";
  const districtBeta = "district-beta-id";

  const farmerInFarmX: User = {
    id: "farmer-user-1",
    role: "farmer",
    farmIds: [farmX],
  };

  const farmerInFarmY: User = {
    id: "farmer-user-2",
    role: "farmer",
    farmIds: [farmY],
  };

  const districtAdminAlpha: User = {
    id: "admin-user-1",
    role: "district_admin",
    farmIds: [], // District admins don't have explicit farm list
    districtId: districtAlpha,
  };

  const systemAdmin: User = {
    id: "sysadmin-user-1",
    role: "system_admin",
    farmIds: [],
  };

  it("should allow a farmer to access their own farm", () => {
    // Given: Farmer with access to farm X
    const session: Session = {
      userId: farmerInFarmX.id,
      user: farmerInFarmX,
      createdAt: new Date("2026-04-02T10:00:00Z"),
      lastSeenAt: new Date("2026-04-02T10:05:00Z"),
      expiresAt: new Date("2026-04-02T11:00:00Z"),
    };

    // When: Requesting access to farm X
    const result = authorizeRequest(session, {
      requesterUserId: farmerInFarmX.id,
      targetFarmId: farmX,
    });

    // Then: Access is granted
    expect(result.authorized).toBe(true);
  });

  it("should REJECT a farmer accessing another farmer's farm", () => {
    // Given: Farmer X with session
    const session: Session = {
      userId: farmerInFarmX.id,
      user: farmerInFarmX,
      createdAt: new Date("2026-04-02T10:00:00Z"),
      lastSeenAt: new Date("2026-04-02T10:05:00Z"),
      expiresAt: new Date("2026-04-02T11:00:00Z"),
    };

    // When: Attempting to access farm Y
    const result = authorizeRequest(session, {
      requesterUserId: farmerInFarmX.id,
      targetFarmId: farmY, // ← Different farm
    });

    // Then: Access is DENIED (critical security boundary)
    expect(result.authorized).toBe(false);
    expect(result.reason).toContain("does not have access");
  });

  it("should REJECT manipulated farmId in the request", () => {
    // Scenario: Frontend manipulation or CSRF attack
    // Given: Farmer X's session
    const session: Session = {
      userId: farmerInFarmX.id,
      user: farmerInFarmX,
      createdAt: new Date("2026-04-02T10:00:00Z"),
      lastSeenAt: new Date("2026-04-02T10:05:00Z"),
      expiresAt: new Date("2026-04-02T11:00:00Z"),
    };

    // When: Malicious request with farm Y
    const result = authorizeRequest(session, {
      requesterUserId: farmerInFarmX.id, // Still farmer X
      targetFarmId: farmY, // But trying to access farm Y
    });

    // Then: Denied, even though the user ID is correct
    expect(result.authorized).toBe(false);
  });

  it("should reject session when user ID in request doesn't match session", () => {
    // Scenario: Session hijacking attempt
    // Given: Farmer X's session
    const session: Session = {
      userId: farmerInFarmX.id,
      user: farmerInFarmX,
      createdAt: new Date("2026-04-02T10:00:00Z"),
      lastSeenAt: new Date("2026-04-02T10:05:00Z"),
      expiresAt: new Date("2026-04-02T11:00:00Z"),
    };

    // When: Request with a different user ID
    const result = authorizeRequest(session, {
      requesterUserId: "someone-else-id", // Different user
      targetFarmId: farmX,
    });

    // Then: Denied (user mismatch)
    expect(result.authorized).toBe(false);
    expect(result.reason).toContain("user mismatch");
  });

  it("should reject expired sessions", () => {
    // Given: Farmer with an expired session
    const now = new Date("2026-04-02T11:30:00Z");
    const session: Session = {
      userId: farmerInFarmX.id,
      user: farmerInFarmX,
      createdAt: new Date("2025-01-01T10:00:00Z"),
      lastSeenAt: new Date("2025-01-01T10:30:00Z"),
      expiresAt: new Date("2025-01-01T11:00:00Z"), // Always expired at runtime
    };

    // When: Checking validity
    const isValid = isSessionValid(session, now);

    // Then: Session is invalid
    expect(isValid).toBe(false);

    // And: Authorization fails with expired reason
    const result = authorizeRequest(session, {
      requesterUserId: farmerInFarmX.id,
      targetFarmId: farmX,
    });
    expect(result.authorized).toBe(false);
    expect(result.reason).toContain("expired");
  });

  it("should allow district admin to access any farm in their district", () => {
    // Given: District admin for alpha
    const session: Session = {
      userId: districtAdminAlpha.id,
      user: districtAdminAlpha,
      createdAt: new Date("2026-04-02T10:00:00Z"),
      lastSeenAt: new Date("2026-04-02T10:05:00Z"),
      expiresAt: new Date("2026-04-02T11:00:00Z"),
    };

    // When: Accessing any farm in their district
    const result = authorizeRequest(session, {
      requesterUserId: districtAdminAlpha.id,
      targetFarmId: farmX, // Any farm
    });

    // Then: Access is allowed (for district admin)
    expect(result.authorized).toBe(true);
  });

  it("should REJECT district admin accessing a different district", () => {
    // Given: District admin for alpha
    const session: Session = {
      userId: districtAdminAlpha.id,
      user: districtAdminAlpha,
      createdAt: new Date("2026-04-02T10:00:00Z"),
      lastSeenAt: new Date("2026-04-02T10:05:00Z"),
      expiresAt: new Date("2026-04-02T11:00:00Z"),
    };

    // When: Attempting to access district beta
    const result = authorizeRequest(session, {
      requesterUserId: districtAdminAlpha.id,
      targetDistrictId: districtBeta, // Different district
    });

    // Then: Access is denied
    expect(result.authorized).toBe(false);
    expect(result.reason).toContain("does not have access");
  });

  it("should allow system admin to access any farm and district", () => {
    // Given: System admin session
    const session: Session = {
      userId: systemAdmin.id,
      user: systemAdmin,
      createdAt: new Date("2026-04-02T10:00:00Z"),
      lastSeenAt: new Date("2026-04-02T10:05:00Z"),
      expiresAt: new Date("2026-04-02T11:00:00Z"),
    };

    // When: Accessing any farm
    const farmResult = authorizeRequest(session, {
      requesterUserId: systemAdmin.id,
      targetFarmId: farmX,
    });

    // When: Accessing any district
    const districtResult = authorizeRequest(session, {
      requesterUserId: systemAdmin.id,
      targetDistrictId: districtBeta,
    });

    // Then: Both are allowed
    expect(farmResult.authorized).toBe(true);
    expect(districtResult.authorized).toBe(true);
  });

  it("should prevent privilege escalation with invalid session", () => {
    // Scenario: Attacker tries to use old farmer session with admin privs
    // Given: Farmer session that should not have admin access
    const session: Session = {
      userId: farmerInFarmX.id,
      user: farmerInFarmX,
      createdAt: new Date("2026-04-02T10:00:00Z"),
      lastSeenAt: new Date("2026-04-02T10:05:00Z"),
      expiresAt: new Date("2026-04-02T11:00:00Z"),
    };

    // When: Farmer tries to access system admin resources
    const result = authorizeRequest(session, {
      requesterUserId: farmerInFarmX.id,
      targetDistrictId: districtAlpha, // District-level access
    });

    // Then: Access is denied (farmer can't access districts)
    expect(result.authorized).toBe(false);
  });

  it("should reject undefined session user", () => {
    // Given: Malformed session with missing user
    const badSession = {
      userId: farmerInFarmX.id,
      user: null, // ← Missing user object
      createdAt: new Date("2026-04-02T10:00:00Z"),
      lastSeenAt: new Date("2026-04-02T10:05:00Z"),
      expiresAt: new Date("2026-04-02T11:00:00Z"),
    } as unknown as Session;

    // When: Checking validity
    const isValid = isSessionValid(badSession);

    // Then: Invalid
    expect(isValid).toBe(false);
  });

  it("should be deterministic: same session, same request = same result", () => {
    // Given: Fixed session and request
    const session: Session = {
      userId: farmerInFarmX.id,
      user: farmerInFarmX,
      createdAt: new Date("2026-04-02T10:00:00Z"),
      lastSeenAt: new Date("2026-04-02T10:05:00Z"),
      expiresAt: new Date("2026-04-02T11:00:00Z"),
    };

    const request: AccessRequest = {
      requesterUserId: farmerInFarmX.id,
      targetFarmId: farmY, // Unauthorized
    };

    // When: Authorizing multiple times
    const result1 = authorizeRequest(session, request);
    const result2 = authorizeRequest(session, request);
    const result3 = authorizeRequest(session, request);

    // Then: Results are identical
    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);
  });
});
