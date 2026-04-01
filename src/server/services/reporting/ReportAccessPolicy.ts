import { TRPCError } from "@trpc/server";

import {
  hasRole,
  requireDistrictAccess,
  requireFarmAccess,
  type AuthContext,
} from "~/server/lib/abac";
import type { ReportRequestInput } from "./types";

export class ReportAccessPolicy {
  async assertCanRequest(
    ctx: AuthContext,
    input: ReportRequestInput,
  ): Promise<void> {
    const scope = input.scope;

    if (scope.scopeType === "global") {
      if (!hasRole(ctx, "admin", "auditor")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Global reports require admin or auditor role",
        });
      }
      return;
    }

    if (scope.scopeType === "district" && scope.districtId) {
      await requireDistrictAccess(ctx, scope.districtId);
      return;
    }

    if (scope.scopeType === "farm" && scope.farmId) {
      await requireFarmAccess(ctx, scope.farmId);
      return;
    }

    if (scope.scopeType === "user" && scope.userId) {
      const canViewAnyUser = hasRole(
        ctx,
        "admin",
        "auditor",
        "district_manager",
      );
      if (scope.userId !== ctx.session.user.id && !canViewAnyUser) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Insufficient permissions for user-scoped report",
        });
      }
    }
  }

  assertCanViewJob(params: {
    actorId: string;
    actorRoles: string[];
    requestedBy: string;
  }): void {
    const isAdminOrAuditor = params.actorRoles.some((role) =>
      ["admin", "auditor"].includes(role),
    );

    if (!isAdminOrAuditor && params.actorId !== params.requestedBy) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You can only view your own report jobs",
      });
    }
  }
}
