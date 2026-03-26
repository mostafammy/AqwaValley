import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { weatherService } from "~/server/services/weatherService";
import { farmWell, well } from "~/server/db/schema";
import { eq } from "drizzle-orm";

export const weatherRouter = createTRPCRouter({
  getCurrent: protectedProcedure
    .input(z.object({ farmId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      let lat = 30.0444; // Default: Cairo
      let lon = 31.2357;

      if (input?.farmId) {
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
          lat = Number(assignedWells[0].lat);
          lon = Number(assignedWells[0].lon);
        }
      }

      const weather = await weatherService.getCurrentWeather(lat, lon);

      return {
        ...weather,
        formatted: `${weather.temp}°م - ${weather.description}`,
      };
    }),
});
