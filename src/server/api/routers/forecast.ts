import { z } from "zod";
import {
  createTRPCRouter,
  operatorProcedure,
  viewerProcedure,
} from "~/server/api/trpc";
import { getDistrictForecast } from "~/server/services/forecastService";
import { createForecastRuntime } from "~/server/services/forecast/runtime";
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

  getDistrictAquiferForecast: operatorProcedure
    .input(z.object({ districtId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await requireDistrictAccess(ctx, input.districtId);

      const runtime = createForecastRuntime(ctx.db);
      return runtime.runDistrictForecast({
        districtId: input.districtId,
        triggerType: "system",
      });
    }),

  triggerRecompute: operatorProcedure
    .input(
      z.object({
        districtId: z.string().uuid(),
        runKey: z.string().min(8).max(128).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireDistrictAccess(ctx, input.districtId);

      const runtime = createForecastRuntime(ctx.db);
      return runtime.runDistrictForecast({
        districtId: input.districtId,
        runKey: input.runKey,
        triggerType: "manual",
      });
    }),
});
