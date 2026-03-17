import { and, eq, inArray, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import type { db as DbInstance } from "~/server/db";
import { farm, userProfile, well } from "~/server/db/schema";

type Db = typeof DbInstance;

/**
 * Minimal authenticated context shape consumed by ABAC helpers.
 * Mirrors the narrowed ctx produced by viewerProcedure / operatorProcedure / adminProcedure.
 */
export type AuthContext = {
  db: Db;
  session: { user: { id: string } };
  userRoles: string[];
};

export type RoleType =
  | "admin"
  | "district_manager"
  | "farm_owner"
  | "farmer"
  | "auditor";

/** True if the context carries at least one of the specified roles. */
export function hasRole(ctx: AuthContext, ...roles: RoleType[]): boolean {
  return ctx.userRoles.some((r) => (roles as string[]).includes(r));
}

/**
 * Resolve the set of district IDs the current user may access.
 * Returns `null` to signal "all districts" (admin / auditor).
 */
export async function getAccessibleDistrictIds(
  ctx: AuthContext,
): Promise<string[] | null> {
  if (hasRole(ctx, "admin", "auditor")) return null;

  // district_manager gets their one assigned district from userProfile
  const profile = await ctx.db
    .select({ districtId: userProfile.districtId })
    .from(userProfile)
    .where(eq(userProfile.userId, ctx.session.user.id))
    .limit(1);

  const profileDistrictId = profile[0]?.districtId;
  if (profileDistrictId) return [profileDistrictId];

  // farm_owner / farmer get all districts their farms belong to
  if (hasRole(ctx, "farm_owner", "farmer")) {
    const farms = await ctx.db
      .select({ districtId: farm.districtId })
      .from(farm)
      .where(
        or(
          eq(farm.ownerId, ctx.session.user.id),
          eq(farm.farmerUserId, ctx.session.user.id),
        ),
      );
    const ids = [...new Set(farms.map((f) => f.districtId))];
    return ids;
  }

  return []; // no access
}

/**
 * True if the user can read/write within the given district.
 */
export async function canAccessDistrict(
  ctx: AuthContext,
  districtId: string,
): Promise<boolean> {
  const accessible = await getAccessibleDistrictIds(ctx);
  if (accessible === null) return true; // all districts
  return accessible.includes(districtId);
}

/**
 * True if the user can interact with the given well.
 * Resolves well → district → access check.
 */
export async function canAccessWell(
  ctx: AuthContext,
  wellId: string,
): Promise<boolean> {
  if (hasRole(ctx, "admin", "auditor")) return true;

  const wellRecord = await ctx.db
    .select({ districtId: well.districtId })
    .from(well)
    .where(eq(well.id, wellId))
    .limit(1);

  if (!wellRecord[0]) return false;
  return canAccessDistrict(ctx, wellRecord[0].districtId);
}

/** Throws FORBIDDEN if the user cannot access the given district. */
export async function requireDistrictAccess(
  ctx: AuthContext,
  districtId: string,
): Promise<void> {
  const allowed = await canAccessDistrict(ctx, districtId);
  if (!allowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Access to this district is not permitted",
    });
  }
}

/** Throws FORBIDDEN if the user cannot access the given well. */
export async function requireWellAccess(
  ctx: AuthContext,
  wellId: string,
): Promise<void> {
  const allowed = await canAccessWell(ctx, wellId);
  if (!allowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Access to this well is not permitted",
    });
  }
}

/**
 * Build a Drizzle WHERE clause that restricts a query to accessible wells.
 * Returns undefined if the user has global access (admin / auditor).
 * Returns a falsy condition if the user has no access at all.
 */
export async function buildWellDistrictFilter(
  ctx: AuthContext,
  districtIds?: string[],
): Promise<ReturnType<typeof inArray> | undefined> {
  const accessible = await getAccessibleDistrictIds(ctx);
  if (accessible === null) {
    // admin/auditor: no filter, or apply the provided override
    if (districtIds?.length) return inArray(well.districtId, districtIds);
    return undefined;
  }

  const ids = districtIds
    ? districtIds.filter((id) => accessible.includes(id))
    : accessible;

  if (ids.length === 0) return inArray(well.districtId, ["__no_access__"]);
  return inArray(well.districtId, ids);
}
