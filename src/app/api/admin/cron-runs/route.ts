import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "~/server/better-auth";
import { db } from "~/server/db";
import { role, userRoleAssignment } from "~/server/db/schema";
import {
  type CronSimulationRunStatus,
  listRuns,
} from "~/server/services/simulatorRunRegistry";
import { env } from "~/env";

const querySchema = z.object({
  status: z.enum(["running", "completed", "failed"]).optional(),
  runKey: z.string().min(1).max(128).optional(),
  from: z
    .string()
    .datetime({ offset: true })
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  to: z
    .string()
    .datetime({ offset: true })
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
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

async function isAdmin(userId: string): Promise<boolean> {
  const [record] = await db
    .select({ type: role.type })
    .from(userRoleAssignment)
    .innerJoin(role, eq(userRoleAssignment.roleId, role.id))
    .where(eq(userRoleAssignment.userId, userId))
    .limit(1);

  return (
    record?.type === "admin" ||
    (await db
      .select({ type: role.type })
      .from(userRoleAssignment)
      .innerJoin(role, eq(userRoleAssignment.roleId, role.id))
      .where(eq(userRoleAssignment.userId, userId))
      .then((rows) => rows.some((r) => r.type === "admin")))
  );
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required");
  }

  const adminCheck = await isAdmin(session.user.id);
  if (!adminCheck) {
    return errorResponse(403, "FORBIDDEN", "Admin access required");
  }

  const rawQuery = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = querySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return errorResponse(
      400,
      "INVALID_QUERY_PARAMETERS",
      "Invalid query parameters",
      parsed.error.flatten(),
    );
  }

  const result = await listRuns({
    status: parsed.data.status as CronSimulationRunStatus | undefined,
    runKey: parsed.data.runKey,
    from: parsed.data.from,
    to: parsed.data.to,
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
  });

  const staleTimeoutMs = env.SIM_RUN_STALE_TIMEOUT_SECONDS * 1000;

  return NextResponse.json({
    rows: result.rows.map((row) => ({
      runKey: row.runKey,
      status: row.status,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      durationMs:
        row.completedAt && row.startedAt
          ? row.completedAt.getTime() - row.startedAt.getTime()
          : null,
      error: row.error,
      isStale:
        row.status === "running"
          ? Date.now() - row.startedAt.getTime() > staleTimeoutMs
          : false,
    })),
    meta: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      hasNext: result.hasNext,
    },
  });
}
