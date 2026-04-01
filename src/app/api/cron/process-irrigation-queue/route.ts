import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { validateCronRequest } from "~/lib/cronAuth";
import { processQueuedIrrigationEvents } from "~/server/services/irrigation/irrigationQueueWorker";

const bodySchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(10),
});

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
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

async function run(limit: number): Promise<NextResponse> {
  try {
    const result = await processQueuedIrrigationEvents(limit);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return errorResponse(
      500,
      "IRRIGATION_QUEUE_PROCESS_FAILED",
      "Failed to process queued irrigation events",
      error instanceof Error ? { message: error.message } : undefined,
    );
  }
}

export async function POST(request: NextRequest) {
  const authResult = await validateCronRequest(request);
  if (!authResult.ok) {
    return errorResponse(401, "CRON_UNAUTHORIZED", "Unauthorized cron request");
  }

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
      "Invalid process-irrigation-queue request",
      parsed.error.flatten(),
    );
  }

  return run(parsed.data.limit);
}

export async function GET(request: NextRequest) {
  const authResult = await validateCronRequest(request);
  if (!authResult.ok) {
    return errorResponse(401, "CRON_UNAUTHORIZED", "Unauthorized cron request");
  }

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

  return run(parsed.data.limit ?? 10);
}
