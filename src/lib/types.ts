/**
 * src/lib/types.ts
 * 
 * Shared TypeScript types across the AquaValley application.
 */

/**
 * Standardized user roles used for UI labeling and dashboard variants.
 * Maps to roles within the Government and Farm portals.
 */
export type UserRole = 
  | "GOV_ADMIN" 
  | "SUPER_ADMIN" 
  | "FARMER" 
  | "DISTRICT_MANAGER" 
  | "AUDITOR";

/**
 * Common structure for API user objects.
 */
export interface AppUser {
  id: string;
  name?: string | null;
  email?: string | null;
  username: string;
}
