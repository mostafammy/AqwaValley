import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

/**
 * Minimal compatibility router retained from the base T3 setup.
 * It prevents app router compile failures while domain routers evolve.
 */
export const postRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string().optional() }).optional())
    .query(({ input }) => {
      return {
        greeting: `hello${input?.text ? ` ${input.text}` : ""}`,
      };
    }),
});
