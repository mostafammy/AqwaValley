"use server";

import { eq } from "drizzle-orm";
import { db } from "../../server/db";
import { userRoleAssignment, role } from "../../server/db/schema";
import { getSession } from "../../server/better-auth/server";

/**
 * Checks the active Better Auth session and returns 
 * the appropriate redirect path depending on user role.
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
