"use server";

import { eq } from "drizzle-orm";
import { db } from "../../server/db";
import { userRoleAssignment, role } from "../../server/db/schema";
import { getSession } from "../../server/better-auth/server";

/**
 * Determine the post-login redirect path for the current authenticated user based on assigned roles.
 *
 * Maps role types to portal routes:
 * - "admin", "district_manager", "auditor" → "/dashboard"
 * - "farm_owner", "farmer" → "/farm/dashboard"
 *
 * @returns `"/dashboard"` for users with "admin", "district_manager", or "auditor"; `"/farm/dashboard"` for users with "farm_owner" or "farmer"; `null` if there is no authenticated user or no mapped role
 */
export async function getUserRolePath(): Promise<string | null> {
  const session = await getSession();
  if (!session?.user?.id) return null;

  // Fetch the user's mapped roles from the DB
  const roles = await db
    .select({ type: role.type })
    .from(userRoleAssignment)
    .innerJoin(role, eq(userRoleAssignment.roleId, role.id))
    .where(eq(userRoleAssignment.userId, session.user.id));

  const roleTypes = roles.map((r) => r.type);

  // Determine portal route based on role type  
  if (
    roleTypes.includes("admin") ||
    roleTypes.includes("district_manager") ||
    roleTypes.includes("auditor")
  ) {
    return "/dashboard";
  }

  if (
    roleTypes.includes("farm_owner") ||
    roleTypes.includes("farmer")
  ) {
    return "/farm/dashboard";
  }

  // Fallback if role is unmapped or empty
  return null;
}
