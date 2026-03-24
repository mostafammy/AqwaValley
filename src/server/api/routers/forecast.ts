import { z } from "zod";
import { createTRPCRouter, viewerProcedure } from "~/server/api/trpc";
import { getDistrictForecast } from "~/server/services/forecastService";
import { requireDistrictAccess } from "~/server/lib/abac";

export const forecastRouter = createTRPCRouter({
  getDistrictForecast: viewerProcedure
    .input(z.object({ districtId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Ensure the user has access to this district
      await requireDistrictAccess(ctx, input.districtId);

      // Fetch the forecast data (currently mocked in the service)
      return getDistrictForecast(ctx.db, input.districtId);
    }),
});
