import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { env } from "~/env";
import { validateCronRequest } from "~/lib/cronAuth";
import { runSimulatorCron } from "~/server/services/simulatorCronIngest";
import {
  beginRun,
  completeRun,
  failRun,
} from "~/server/services/simulatorRunRegistry";

const bodySchema = z.object({
  runKey: z.string().min(8).max(128).optional(),
  wellIds: z.array(z.string().uuid()).min(1).optional(),
  readingsPerSensor: z.number().int().min(1).max(10).optional().default(1),
  anomalyRate: z.number().min(0).max(1).optional(),
  timestamp: z
    .string()
    .datetime({ offset: true })
    .optional()
    .transform((value) => (value ? new Date(value) : undefined)),
});

const querySchema = z.object({
  runKey: z.string().min(8).max(128).optional(),
  wellIds: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : undefined,
    )
    .pipe(z.array(z.string().uuid()).min(1).optional()),
  readingsPerSensor: z.coerce.number().int().min(1).max(10).optional(),
  anomalyRate: z.coerce.number().min(0).max(1).optional(),
  timestamp: z
    .string()
    .datetime({ offset: true })
    .optional()
    .transform((value) => (value ? new Date(value) : undefined)),
});

type CronRequestData = z.infer<typeof bodySchema>;

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

function extractRunKey(
  headers: Headers,
  bodyRunKey?: string,
): string | undefined {
  return (
    bodyRunKey ??
    headers.get("x-idempotency-key") ??
    headers.get("x-run-key") ??
    undefined
  );
}

async function runCronSimulation(
  request: NextRequest,
  data: CronRequestData,
): Promise<NextResponse> {
  const authResult = validateCronRequest(request.headers);
  if (!authResult.ok) {
    return errorResponse(401, "CRON_UNAUTHORIZED", "Unauthorized cron request");
  }

  if (data.wellIds && data.wellIds.length > env.SIM_CRON_MAX_WELLS) {
    return errorResponse(
      400,
      "WELL_LIMIT_EXCEEDED",
      `Maximum wellIds per run is ${env.SIM_CRON_MAX_WELLS}`,
    );
  }

  const runKey = extractRunKey(request.headers, data.runKey);

  if (runKey) {
    const existing = await beginRun(runKey, env.SIM_RUN_STALE_TIMEOUT_SECONDS);

    if (existing.status === "completed") {
      const replayPayload =
        existing.response && typeof existing.response === "object"
          ? {
              ...(existing.response as Record<string, unknown>),
              idempotentReplay: true,
            }
          : {
              runId: runKey,
              idempotentReplay: true,
              response: existing.response,
            };
      return NextResponse.json(replayPayload, { status: 200 });
    }

    if (existing.status === "running") {
      return errorResponse(
        409,
        "RUN_IN_PROGRESS",
        "A cron simulation with this run key is already running",
      );
    }

    if (existing.status === "failed") {
      return errorResponse(
        409,
        "RUN_ALREADY_FAILED",
        "A cron simulation with this run key has already failed",
        { reason: existing.error },
      );
    }
  }

  try {
    const result = await runSimulatorCron({
      runId: runKey,
      wellIds: data.wellIds,
      readingsPerSensor: data.readingsPerSensor,
      anomalyRate: data.anomalyRate,
      timestamp: data.timestamp,
    });

    if (runKey) {
      await completeRun(runKey, result);
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[cron_simulate_ingest_error]", error);

    if (runKey) {
      const message =
        error instanceof Error ? error.message : "Unknown cron execution error";
      await failRun(runKey, message);
    }

    return errorResponse(
      500,
      "CRON_RUN_FAILED",
      "Failed to execute cron simulation",
    );
  }
}

export async function POST(request: NextRequest) {
  let rawBody: unknown = {};
  try {
    const text = await request.text();
    rawBody = text.trim() ? (JSON.parse(text) as unknown) : {};
  } catch {
    return errorResponse(
      400,
      "INVALID_JSON",
      "Request body must be valid JSON",
    );
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

  return runCronSimulation(request, parsed.data);
}

export async function GET(request: NextRequest) {
  const rawQuery = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = querySchema.safeParse(rawQuery);

  if (!parsed.success) {
    return errorResponse(
      400,
      "INVALID_QUERY",
      "Invalid query parameters",
      parsed.error.flatten(),
    );
  }

  const data: CronRequestData = {
    runKey: parsed.data.runKey,
    wellIds: parsed.data.wellIds,
    readingsPerSensor: parsed.data.readingsPerSensor ?? 1,
    anomalyRate: parsed.data.anomalyRate,
    timestamp: parsed.data.timestamp,
  };

  return runCronSimulation(request, data);
}
