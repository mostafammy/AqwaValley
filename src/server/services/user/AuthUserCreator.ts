/**
 * AuthUserCreator — Adapter Pattern
 *
 * Pattern: Adapter — wraps better-auth's createUser API.
 * The rest of the codebase NEVER imports from better-auth directly.
 *
 * Migration strategy: if better-auth is replaced with Lucia or Clerk,
 * rewrite THIS file only. Everything else stays identical.
 *
 * Creates an account with a cryptographically random placeholder password.
 * The user will NEVER know this password — they set their own via the
 * invitation token flow (acceptInvitation procedure).
 */

import { randomBytes } from "crypto";
import { TRPCError } from "@trpc/server";
import { auth } from "~/server/better-auth/config";
import type { IAuthUserCreator } from "./interfaces";
import type { DrizzleDB } from "~/server/db/index";

export class AuthUserCreator implements IAuthUserCreator {
  async createUser(
    input: {
      email: string;
      nationalId: string;
      fullName: string;
    },
    // Optional tx provided by orchestrator for atomicity; not used here
    _tx?: DrizzleDB,
  ): Promise<{ authUserId: string }> {
    // Generate a random placeholder password — user never knows this.
    // It is superseded when they accept their invitation and set a real password.
    const placeholder = randomBytes(32).toString("hex");

    try {
      const response = await auth.api.signUpEmail({
        body: {
          email: input.email,
          password: placeholder,
          name: input.fullName,
          // better-auth username plugin uses nationalId as username
          username: input.nationalId,
        },
      });

      // better-auth returns { user, session } on success
      if (!response?.user?.id) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AuthUserCreator: better-auth did not return a user ID",
        });
      }

      return { authUserId: response.user.id };
    } catch (err) {
      if (err instanceof TRPCError) throw err;

      const message = err instanceof Error ? err.message : String(err);

      // Map better-auth-specific errors to typed TRPC errors
      if (
        message.toLowerCase().includes("email") &&
        message.toLowerCase().includes("exist")
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A user with email ${input.email} already exists`,
        });
      }

      if (
        message.toLowerCase().includes("username") &&
        message.toLowerCase().includes("exist")
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A user with national ID ${input.nationalId} already exists`,
        });
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `AuthUserCreator: ${message}`,
      });
    }
  }
}
