import { and, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { role, userProfile, userRoleAssignment } from "~/server/db/schema";

const roleTypeValues = [
  "admin",
  "district_manager",
  "farm_owner",
  "farmer",
  "auditor",
] as const;

export const usersRouter = createTRPCRouter({
  /**
   * List all users in a district (admin only).
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
   * Get a user's current role assignments.
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
   * Assign a role to a user (admin only).
   */
  assignRole: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        roleType: z.enum(roleTypeValues),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Resolve role ID from type
      const [roleRecord] = await ctx.db
        .select({ id: role.id })
        .from(role)
        .where(eq(role.type, input.roleType))
        .limit(1);

      if (!roleRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Role type '${input.roleType}' not found in role catalog`,
        });
      }

      // Upsert — ignore if already assigned
      const [result] = await ctx.db
        .insert(userRoleAssignment)
        .values({
          userId: input.userId,
          roleId: roleRecord.id,
          assignedBy: ctx.session.user.id,
        })
        .onConflictDoNothing()
        .returning();

      return result ?? { message: "Role already assigned" };
    }),

  /**
   * Revoke a role from a user (admin only).
   */
  revokeRole: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        roleType: z.enum(roleTypeValues),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [roleRecord] = await ctx.db
        .select({ id: role.id })
        .from(role)
        .where(eq(role.type, input.roleType))
        .limit(1);

      if (!roleRecord) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db
        .delete(userRoleAssignment)
        .where(
          and(
            eq(userRoleAssignment.userId, input.userId),
            eq(userRoleAssignment.roleId, roleRecord.id),
          ),
        );

      return { success: true };
    }),

  /**
   * Create a domain user profile after sign-up.
   * Called from the Better Auth onSignUp hook or an admin flow.
   */
  createProfile: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        nationalId: z.string().min(10).max(20),
        fullName: z.string().min(1).max(255),
        phoneNumber: z.string().optional(),
        districtId: z.string().uuid().optional(),
        initialRole: z.enum(roleTypeValues).default("auditor"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [roleRecord] = await ctx.db
        .select({ id: role.id })
        .from(role)
        .where(eq(role.type, input.initialRole))
        .limit(1);

      if (!roleRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Role type '${input.initialRole}' not found in role catalog`,
        });
      }

      return ctx.db.transaction(async (tx) => {
        const [profile] = await tx
          .insert(userProfile)
          .values({
            userId: input.userId,
            nationalId: input.nationalId,
            fullName: input.fullName,
            phoneNumber: input.phoneNumber ?? null,
            districtId: input.districtId ?? null,
            isActive: true,
          })
          .returning();

        await tx
          .insert(userRoleAssignment)
          .values({
            userId: input.userId,
            roleId: roleRecord.id,
            assignedBy: ctx.session.user.id,
          })
          .onConflictDoNothing();

        return profile;
      });
    }),

  /**
   * Deactivate a user's domain profile.
   */
  deactivate: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(userProfile)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(userProfile.userId, input.userId));

      return { success: true };
    }),
});
