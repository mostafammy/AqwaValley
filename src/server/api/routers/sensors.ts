import { and, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  adminProcedure,
  createTRPCRouter,
  operatorProcedure,
  viewerProcedure,
} from "~/server/api/trpc";
import { requireWellAccess } from "~/server/lib/abac";
import {
  apiKey,
  latestSensorState,
  sensors,
  well,
} from "~/server/db/schema";
import { generateApiKey, hashApiKey } from "~/lib/apiKeyAuth";

const sensorTypeValues = [
  "water_level",
  "pressure",
  "flow_rate",
  "temperature",
  "humidity",
] as const;

const sensorUnitValues = [
  "meters",
  "bar",
  "celsius",
  "m3_per_hour",
  "percent",
] as const;

export const sensorsRouter = createTRPCRouter({
  /**
   * Attach a new sensor to a well.
   * Sets well.hasSensor = true on first attachment.
   */
  attachToWell: operatorProcedure
    .input(
      z.object({
        wellId: z.string().uuid(),
        type: z.enum(sensorTypeValues),
        unit: z.enum(sensorUnitValues),
        name: z.string().max(255).optional(),
        description: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireWellAccess(ctx, input.wellId);

      const [created] = await ctx.db
        .insert(sensors)
        .values({
          wellId: input.wellId,
          type: input.type,
          unit: input.unit,
          name: input.name ?? null,
          description: input.description ?? null,
          isActive: true,
        })
        .returning();

      // Ensure well.hasSensor is true
      await ctx.db
        .update(well)
        .set({ hasSensor: true, updatedAt: new Date() })
        .where(eq(well.id, input.wellId));

      return created;
    }),

  /**
   * List all active sensors for a well, with latest state merged in.
   */
  listByWell: viewerProcedure
    .input(z.object({ wellId: z.string().uuid(), includeInactive: z.boolean().default(false) }))
    .query(async ({ ctx, input }) => {
      await requireWellAccess(ctx, input.wellId);

      const conditions = [eq(sensors.wellId, input.wellId)];
      if (!input.includeInactive) conditions.push(eq(sensors.isActive, true));

      const [sensorList, latestStates] = await Promise.all([
        ctx.db
          .select()
          .from(sensors)
          .where(and(...conditions)),
        ctx.db
          .select()
          .from(latestSensorState)
          .where(eq(latestSensorState.wellId, input.wellId)),
      ]);

      const stateMap = new Map(latestStates.map((s) => [s.sensorId, s]));

      return sensorList.map((s) => ({
        ...s,
        latestState: stateMap.get(s.id) ?? null,
      }));
    }),

  /**
   * Update sensor name or description.
   */
  update: operatorProcedure
    .input(
      z.object({
        sensorId: z.string().uuid(),
        name: z.string().max(255).optional(),
        description: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [sensor] = await ctx.db
        .select({ wellId: sensors.wellId })
        .from(sensors)
        .where(eq(sensors.id, input.sensorId))
        .limit(1);

      if (!sensor) throw new TRPCError({ code: "NOT_FOUND" });
      await requireWellAccess(ctx, sensor.wellId);

      const [updated] = await ctx.db
        .update(sensors)
        .set({
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          updatedAt: new Date(),
        })
        .where(eq(sensors.id, input.sensorId))
        .returning();

      return updated;
    }),

  /**
   * Soft-deactivate a sensor. Historical data is preserved.
   */
  deactivate: operatorProcedure
    .input(z.object({ sensorId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [sensor] = await ctx.db
        .select({ wellId: sensors.wellId })
        .from(sensors)
        .where(eq(sensors.id, input.sensorId))
        .limit(1);

      if (!sensor) throw new TRPCError({ code: "NOT_FOUND" });
      await requireWellAccess(ctx, sensor.wellId);

      await ctx.db
        .update(sensors)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(sensors.id, input.sensorId));

      return { success: true };
    }),

  /**
   * Generate a scoped API key for this sensor's well.
   * The raw key is returned ONCE — only the SHA-256 hash is stored.
   */
  generateApiKey: operatorProcedure
    .input(
      z.object({
        sensorId: z.string().uuid(),
        keyName: z.string().min(1).max(100),
        expiresInDays: z.number().int().min(1).max(365).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [sensor] = await ctx.db
        .select({ wellId: sensors.wellId })
        .from(sensors)
        .where(eq(sensors.id, input.sensorId))
        .limit(1);

      if (!sensor) throw new TRPCError({ code: "NOT_FOUND" });
      await requireWellAccess(ctx, sensor.wellId);

      const rawKey = generateApiKey();
      const hashed = hashApiKey(rawKey);

      const expiresAt =
        input.expiresInDays != null
          ? new Date(Date.now() + input.expiresInDays * 86_400_000)
          : null;

      const [record] = await ctx.db
        .insert(apiKey)
        .values({
          hashedKey: hashed,
          name: input.keyName,
          wellId: sensor.wellId,
          createdByUserId: ctx.session.user.id,
          expiresAt,
          isActive: true,
        })
        .returning({ id: apiKey.id, name: apiKey.name, expiresAt: apiKey.expiresAt });

      return {
        id: record!.id,
        name: record!.name,
        expiresAt: record!.expiresAt,
        // Raw key returned once only — treat it as a secret
        rawKey,
      };
    }),

  /**
   * List API keys associated with a well (hashes never exposed).
   */
  listApiKeys: viewerProcedure
    .input(z.object({ wellId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireWellAccess(ctx, input.wellId);

      return ctx.db
        .select({
          id: apiKey.id,
          name: apiKey.name,
          isActive: apiKey.isActive,
          expiresAt: apiKey.expiresAt,
          lastUsedAt: apiKey.lastUsedAt,
          createdAt: apiKey.createdAt,
        })
        .from(apiKey)
        .where(eq(apiKey.wellId, input.wellId))
        .orderBy(apiKey.createdAt);
    }),

  /**
   * Revoke (deactivate) an API key.
   */
  revokeApiKey: operatorProcedure
    .input(z.object({ apiKeyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [record] = await ctx.db
        .select({ wellId: apiKey.wellId })
        .from(apiKey)
        .where(eq(apiKey.id, input.apiKeyId))
        .limit(1);

      if (!record) throw new TRPCError({ code: "NOT_FOUND" });
      if (record.wellId) await requireWellAccess(ctx, record.wellId);

      await ctx.db
        .update(apiKey)
        .set({ isActive: false })
        .where(eq(apiKey.id, input.apiKeyId));

      return { success: true };
    }),
});
