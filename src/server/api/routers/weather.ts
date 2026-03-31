import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { weatherService } from "~/server/services/weatherService";
import { farm, farmWell, well } from "~/server/db/schema";
import { and, eq, or } from "drizzle-orm";

export const weatherRouter = createTRPCRouter({
  getCurrent: protectedProcedure
    .input(z.object({ farmId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      let lat = 30.0444; // Default: Cairo
      let lon = 31.2357;

      if (input?.farmId) {
        // Authorization check: ensure the user owns or is associated with this farm
        const farmRecord = await ctx.db
          .select()
          .from(farm)
          .where(
            and(
              eq(farm.id, input.farmId),
              or(
                eq(farm.ownerId, ctx.session?.user?.id),
                eq(farm.farmerUserId, ctx.session?.user?.id),
              ),
            ),
          )
          .limit(1);

        if (!farmRecord[0]) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Not authorized for this farm",
          });
        }

        // Try to find a well associated with this farm to get coordinates
        const assignedWells = await ctx.db
          .select({
            lat: well.latitude,
            lon: well.longitude,
          })
          .from(farmWell)
          .innerJoin(well, eq(farmWell.wellId, well.id))
          .where(eq(farmWell.farmId, input.farmId))
          .limit(1);

        if (assignedWells[0]) {
          const rawLat = Number(assignedWells[0].lat);
          const rawLon = Number(assignedWells[0].lon);
          
          if (Number.isFinite(rawLat) && Number.isFinite(rawLon)) {
            lat = rawLat;
            lon = rawLon;
          }
        }
      }

      const weather = await weatherService.getCurrentWeather(lat, lon);

      return {
        ...weather,
        formatted: `${weather.temp}°م - ${weather.description}`,
      };
    }),

  getForecast: protectedProcedure
    .input(z.object({ farmId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // 1. Authorization check
      const farmRecord = await ctx.db
        .select()
        .from(farm)
        .where(
          and(
            eq(farm.id, input.farmId),
            or(
              eq(farm.ownerId, ctx.session?.user?.id),
              eq(farm.farmerUserId, ctx.session?.user?.id),
            ),
          ),
        )
        .limit(1);

      if (!farmRecord[0]) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized for this farm",
        });
      }

      // 2. Resolve coordinates
      let lat = 25.4474; // Default to Kharga
      let lon = 30.546;

      const assignedWells = await ctx.db
        .select({ lat: well.latitude, lon: well.longitude })
        .from(farmWell)
        .innerJoin(well, eq(farmWell.wellId, well.id))
        .where(eq(farmWell.farmId, input.farmId))
        .limit(1);

      if (assignedWells[0]) {
        lat = Number(assignedWells[0].lat);
        lon = Number(assignedWells[0].lon);
      }

      const forecast = await weatherService.getForecastWithEt0(lat, lon, 3);
      return forecast;
    }),
});
