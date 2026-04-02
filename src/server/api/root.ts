import { wellsRouter } from "~/server/api/routers/wells";
import { sensorsRouter } from "~/server/api/routers/sensors";
import { alertsRouter } from "~/server/api/routers/alerts";
import { analyticsRouter } from "~/server/api/routers/analytics";
import { usersRouter } from "~/server/api/routers/users";
import { quotasRouter } from "~/server/api/routers/quotas";
import { irrigationRouter } from "~/server/api/routers/irrigation";
import { forecastRouter } from "~/server/api/routers/forecast";
import { weatherRouter } from "~/server/api/routers/weather";
import { reportsRouter } from "~/server/api/routers/reports";

import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  wells: wellsRouter,
  sensors: sensorsRouter,
  alerts: alertsRouter,
  analytics: analyticsRouter,
  users: usersRouter,
  quotas: quotasRouter,
  irrigation: irrigationRouter,
  forecast: forecastRouter,
  weather: weatherRouter,
  reports: reportsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
