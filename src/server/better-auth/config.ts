import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";

import {
  NATIONAL_ID_MAX_LENGTH,
  NATIONAL_ID_MIN_LENGTH,
  nationalIdSchema,
} from "~/lib/national-id";
import { env } from "~/env";
import { db } from "~/server/db";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg", // or "pg" or "mysql"
  }),
  disabledPaths: ["/is-username-available"],
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    username({
      minUsernameLength: NATIONAL_ID_MIN_LENGTH,
      maxUsernameLength: NATIONAL_ID_MAX_LENGTH,
      usernameNormalization: false,
      usernameValidator: (value) => nationalIdSchema.safeParse(value).success,
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
