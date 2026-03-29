import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { validateCronRequest } from "~/lib/cronAuth";
import { db } from "~/server/db";
import { district } from "~/server/db/schema";
import { createForecastRuntime } from "~/server/services/forecast/runtime";

const bodySchema = z.object({
  districtIds: z.array(z.string().uuid()).min(1).optional(),
  runKeyPrefix: z.string().min(4).max(64).optional(),
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
      "Invalid aquifer forecast request",
      parsed.error.flatten(),
    );
  }

  const selectedDistrictIds =
    parsed.data.districtIds ??
    (await db.select({ id: district.id }).from(district)).map((d) => d.id);

  if (selectedDistrictIds.length === 0) {
    return NextResponse.json(
      { summary: "no_districts", results: [] },
      { status: 200 },
    );
  }

  const runtime = createForecastRuntime(db);
  const results = [] as Array<{
    districtId: string;
    result: Awaited<ReturnType<typeof runtime.runDistrictForecast>>;
  }>;

  for (const districtId of selectedDistrictIds) {
    const runKey = parsed.data.runKeyPrefix
      ? `${parsed.data.runKeyPrefix}:${districtId}`
      : undefined;
    const result = await runtime.runDistrictForecast({
      districtId,
      runKey,
      triggerType: "cron",
    });
    results.push({ districtId, result });
  }

  const failures = results.filter((r) => r.result.status === "failed").length;

  return NextResponse.json(
    {
      summary:
        failures === 0
          ? "ok"
          : failures === results.length
            ? "failed"
            : "partial_failure",
      totalDistricts: results.length,
      failures,
      results,
    },
    { status: failures === results.length ? 500 : 200 },
  );
}

export async function GET(request: NextRequest) {
  return POST(request);
}
