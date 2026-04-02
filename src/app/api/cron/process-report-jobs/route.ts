import { NextResponse } from "next/server";
import { z } from "zod";

import { validateCronRequest } from "~/lib/cronAuth";
import { db } from "~/server/db";
import { ReportingOrchestrator } from "~/server/services/reporting/ReportingOrchestrator";
import { env } from "~/env";

export const runtime = "nodejs";

const bodySchema = z.object({
  maxJobs: z.number().int().min(1).max(100).optional(),
});

async function run(request: Request): Promise<NextResponse> {
  const authResult = await Promise.resolve(validateCronRequest(request));
  if (!authResult.ok) {
    return NextResponse.json(
      { ok: false, error: authResult.reason ?? "Unauthorized" },
      { status: 401 },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  let parsedBody:
    | ReturnType<typeof bodySchema.safeParse>
    | { success: true; data: Record<string, never> };

  if (contentType.includes("application/json")) {
    try {
      parsedBody = bodySchema.safeParse(await request.json());
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid cron payload",
          details: error instanceof Error ? { message: error.message } : {},
        },
        { status: 400 },
      );
    }
  } else {
    parsedBody = { success: true, data: {} };
  }

  if (!parsedBody.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid cron payload",
        details: parsedBody.error.flatten(),
      },
      { status: 400 },
    );
  }

  const maxJobs =
    parsedBody.data.maxJobs ??
    Number.parseInt(String(env.REPORT_QUEUE_BATCH_SIZE), 10);

  const orchestrator = new ReportingOrchestrator(db);
  const result = await orchestrator.processQueue({
    actorId: undefined,
    maxJobs,
  });

  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request: Request): Promise<NextResponse> {
  return run(request);
}

export async function GET(request: Request): Promise<NextResponse> {
  return run(request);
}
