import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    BETTER_AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    BETTER_AUTH_URL: z.string().url(),
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    LOG_LEVEL: z
      .enum(["trace", "debug", "info", "warn", "error", "fatal"])
      .default("info"),
    CRON_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string().min(16)
        : z.string().min(1).optional(),
    TIMESCALE_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
    INGEST_RATE_LIMIT_PER_MINUTE: z.coerce
      .number()
      .int()
      .positive()
      .default(300),
    SIM_CRON_MAX_WELLS: z.coerce.number().int().positive().default(100),
    SIM_CRON_MAX_SENSORS: z.coerce.number().int().positive().default(1000),
    SIM_DEFAULT_ANOMALY_RATE: z.coerce.number().min(0).max(1).default(0.05),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    LOG_LEVEL: process.env.LOG_LEVEL,
    CRON_SECRET: process.env.CRON_SECRET,
    TIMESCALE_RETENTION_DAYS: process.env.TIMESCALE_RETENTION_DAYS,
    INGEST_RATE_LIMIT_PER_MINUTE: process.env.INGEST_RATE_LIMIT_PER_MINUTE,
    SIM_CRON_MAX_WELLS: process.env.SIM_CRON_MAX_WELLS,
    SIM_CRON_MAX_SENSORS: process.env.SIM_CRON_MAX_SENSORS,
    SIM_DEFAULT_ANOMALY_RATE: process.env.SIM_DEFAULT_ANOMALY_RATE,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
