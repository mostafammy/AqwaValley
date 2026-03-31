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
import type { DBConnection } from "~/server/db/index";
import { auditLog, farm } from "~/server/db/schema";
import type { IFarmScopeAssigner } from "./interfaces";

export class FarmScopeAssigner implements IFarmScopeAssigner {
  constructor(private readonly db: DBConnection) {}

  async assign(
    input: {
      userId: string;
      farmId: string;
      actorId: string;
      ipAddress?: string;
    },
    tx?: DBConnection,
  ): Promise<void> {
    // Use the provided transaction handle when present, otherwise fall back to
    // the instance DB connection. Read the current farm state through that
    // handle so the 'before' snapshot is consistent with the update and only
    // write an audit row if the update actually modified a row.
    const db = tx ?? this.db;

    // If caller provided a transaction, operate on that handle
    if (tx) {
      const existingFarm = await db.query.farm.findFirst({
        where: eq(farm.id, input.farmId),
        columns: { id: true, farmerUserId: true, name: true },
      });

      if (!existingFarm) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `FarmScopeAssigner: farm ${input.farmId} not found`,
        });
      }

      // Use RETURNING to determine if the update affected a row
      const updated = await db
        .update(farm)
        .set({ farmerUserId: input.userId })
        .where(eq(farm.id, input.farmId))
        .returning({ id: farm.id });

      if (Array.isArray(updated) && updated.length > 0) {
        await db.insert(auditLog).values({
          entityType: "farm_scope",
          entityId: input.userId,
          actorId: input.actorId,
          before: {
            farmId: input.farmId,
            farmerUserId: existingFarm.farmerUserId,
          },
          after: { farmId: input.farmId, farmerUserId: input.userId },
          ipAddress: input.ipAddress ?? null,
        });
      }

      return;
    }

    // No external transaction provided — run a local transaction and perform
    // the select/update/audit inside it so the 'before' snapshot lines up with
    // the committed update.
    await this.db.transaction(async (innerTx) => {
      const existingFarm = await innerTx.query.farm.findFirst({
        where: eq(farm.id, input.farmId),
        columns: { id: true, farmerUserId: true, name: true },
      });

      if (!existingFarm) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `FarmScopeAssigner: farm ${input.farmId} not found`,
        });
      }

      const updated = await innerTx
        .update(farm)
        .set({ farmerUserId: input.userId })
        .where(eq(farm.id, input.farmId))
        .returning({ id: farm.id });

      if (Array.isArray(updated) && updated.length > 0) {
        await innerTx.insert(auditLog).values({
          entityType: "farm_scope",
          entityId: input.userId,
          actorId: input.actorId,
          before: {
            farmId: input.farmId,
            farmerUserId: existingFarm.farmerUserId,
          },
          after: { farmId: input.farmId, farmerUserId: input.userId },
          ipAddress: input.ipAddress ?? null,
        });
      }
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
