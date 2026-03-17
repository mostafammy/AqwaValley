import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { env } from "~/env";
import { validateCronRequest } from "~/lib/cronAuth";
import { runSimulatorCron } from "~/server/services/simulatorCronIngest";

const bodySchema = z.object({
  wellIds: z.array(z.string().uuid()).min(1).optional(),
  readingsPerSensor: z.number().int().min(1).max(10).optional().default(1),
  anomalyRate: z.number().min(0).max(1).optional(),
  timestamp: z
    .string()
    .datetime({ offset: true })
    .optional()
    .transform((value) => (value ? new Date(value) : undefined)),
});

function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    { status },
  );
}

export async function POST(request: NextRequest) {
  const authResult = validateCronRequest(request.headers);
  if (!authResult.ok) {
    return errorResponse(401, "CRON_UNAUTHORIZED", "Unauthorized cron request");
  }

  let rawBody: unknown = {};
  try {
    const text = await request.text();
    rawBody = text.trim() ? (JSON.parse(text) as unknown) : {};
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON");
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return errorResponse(
      400,
      "INVALID_REQUEST",
      "Invalid cron simulation request",
      parsed.error.flatten(),
    );
  }

  if (parsed.data.wellIds && parsed.data.wellIds.length > env.SIM_CRON_MAX_WELLS) {
    return errorResponse(
      400,
      "WELL_LIMIT_EXCEEDED",
      `Maximum wellIds per run is ${env.SIM_CRON_MAX_WELLS}`,
    );
  }

  try {
    const result = await runSimulatorCron({
      wellIds: parsed.data.wellIds,
      readingsPerSensor: parsed.data.readingsPerSensor,
      anomalyRate: parsed.data.anomalyRate,
      timestamp: parsed.data.timestamp,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[cron_simulate_ingest_error]", error);
    return errorResponse(500, "CRON_RUN_FAILED", "Failed to execute cron simulation");
  }
}
