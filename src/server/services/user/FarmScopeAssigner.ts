/**
 * FarmScopeAssigner — Command Pattern
 *
 * Pattern: Command — farm assignment mutation + audit_log write as one atomic unit.
 * Same guarantee as RoleAssigner: you cannot call assign() without the audit row.
 *
 * Sets farm.farmerUserId — the operational assignment of a farmer to a farm.
 * Distinct from farm.ownerId which is the legal owner and does not change here.
 */

import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { DrizzleDB } from "~/server/db/index";
import { auditLog, farm } from "~/server/db/schema";
import type { IFarmScopeAssigner } from "./interfaces";

export class FarmScopeAssigner implements IFarmScopeAssigner {
  constructor(private readonly db: DrizzleDB) {}

  async assign(input: {
    userId: string;
    farmId: string;
    actorId: string;
    ipAddress?: string;
  }): Promise<void> {
    // Fetch current farm state for the audit 'before' snapshot
    const existingFarm = await this.db.query.farm.findFirst({
      where: eq(farm.id, input.farmId),
      columns: { id: true, farmerUserId: true, name: true },
    });

    if (!existingFarm) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `FarmScopeAssigner: farm ${input.farmId} not found`,
      });
    }

    // Command: DB mutation + audit_log write as one transaction
    await this.db.transaction(async (tx) => {
      await tx
        .update(farm)
        .set({ farmerUserId: input.userId })
        .where(eq(farm.id, input.farmId));

      // Audit log — written inside the command, always
      await tx.insert(auditLog).values({
        entityType: "farm_scope",
        entityId: input.userId,
        actorId: input.actorId,
        before: { farmId: input.farmId, farmerUserId: existingFarm.farmerUserId },
        after: { farmId: input.farmId, farmerUserId: input.userId },
        ipAddress: input.ipAddress ?? null,
      });
    });
  }

  /** Returns the farm name for use in the email payload */
  async getFarmName(farmId: string): Promise<string> {
    const result = await this.db.query.farm.findFirst({
      where: eq(farm.id, farmId),
      columns: { name: true },
    });
    return result?.name ?? farmId;
  }
}
