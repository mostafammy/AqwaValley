import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "~/server/db";
import { role, userRoleAssignment, well } from "~/server/db/schema";
import { auth } from "~/server/better-auth";
import { eq, sql } from "drizzle-orm";
import { canAccessWell } from "~/server/lib/abac";

// Query for metrics from TimescaleDB using time_bucket
async function fetchMetrics(
  wellId: string,
  rangeHours: number,
  bucketMinutes: number,
  sensorType?: string,
  previousPeriod = false,
) {
  const timeFilter = previousPeriod
    ? sql`sd.timestamp >= NOW() - (${(rangeHours * 2).toString()} || ' hours')::interval AND sd.timestamp < NOW() - (${rangeHours.toString()} || ' hours')::interval`
    : sql`sd.timestamp >= NOW() - (${rangeHours.toString()} || ' hours')::interval AND sd.timestamp <= NOW()`;

  let typeFilter = sql`1=1`;
  if (sensorType) {
    typeFilter = sql`s.type = ${sensorType}::sensor_type`;
  }

  const result = await db.execute(sql`
    SELECT
      time_bucket(${bucketMinutes.toString() + " minutes"}::interval, sd.timestamp) AS bucket,
      s.type,
      s.unit,
      AVG(sd.value)::float  AS avg_value,
      MIN(sd.value)::float  AS min_value,
      MAX(sd.value)::float  AS max_value,
      COUNT(*)::int         AS count
    FROM sensor_data sd
    JOIN sensors s ON s.id = sd.sensor_id
    WHERE s.well_id = ${wellId}::uuid
      AND ${timeFilter}
      AND ${typeFilter}
    GROUP BY bucket, s.type, s.unit
    ORDER BY bucket ASC
  `);

  return result as unknown as {
    bucket: Date;
    type: string;
    unit: string;
    avg_value: number;
    min_value: number;
    max_value: number;
    count: number;
  }[];
}

// Build a CSV string from rows
function toCsv(rows: Awaited<ReturnType<typeof fetchMetrics>>): string {
  const header = "bucket,type,unit,avg_value,min_value,max_value,count";
  const lines = rows.map(
    (r) =>
      `${r.bucket.toISOString()},${r.type},${r.unit},${r.avg_value},${r.min_value},${r.max_value},${r.count}`,
  );
  return [header, ...lines].join("\n");
}

const querySchema = z.object({
  range: z
    .string()
    .regex(/^\d+h$/)
    .optional()
    .transform((v) => parseInt(v ?? "24h", 10))
    .pipe(
      z
        .number()
        .int()
        .min(1)
        .max(24 * 365),
    ),
  bucket: z
    .string()
    .regex(/^\d+m$/)
    .optional()
    .transform((v) => parseInt(v ?? "60m", 10))
    .pipe(
      z
        .number()
        .int()
        .min(1)
        .max(24 * 60),
    ),
  format: z.enum(["json", "csv"]).optional().default("json"),
  sensorType: z.string().optional(),
  compare: z.string().transform(v => v === 'true').optional().default('false'),
});

const paramsSchema = z.object({
  id: z.string().uuid(),
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

async function getUserRoles(userId: string): Promise<string[]> {
  const rows = await db
    .select({ type: role.type })
    .from(userRoleAssignment)
    .innerJoin(role, eq(userRoleAssignment.roleId, role.id))
    .where(eq(userRoleAssignment.userId, userId));

  return rows.map((r) => r.type);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Auth check
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return errorResponse(401, "UNAUTHORIZED", "Authentication required");
    }

    const rawParams = await params;
    const parsedParams = paramsSchema.safeParse(rawParams);
    if (!parsedParams.success) {
      return errorResponse(400, "INVALID_WELL_ID", "Well id must be a UUID", {
        fieldErrors: parsedParams.error.flatten().fieldErrors,
      });
    }

    const wellId = parsedParams.data.id;

    const userRoles = await getUserRoles(session.user.id);
    const canReadWell = await canAccessWell(
      {
        db,
        session: { user: { id: session.user.id } },
        userRoles,
      },
      wellId,
    );

    if (!canReadWell) {
      return errorResponse(403, "FORBIDDEN", "Access to this well is denied", {
        wellId,
      });
    }

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parsedQuery = querySchema.safeParse(searchParams);
    if (!parsedQuery.success) {
      return errorResponse(
        400,
        "INVALID_QUERY_PARAMETERS",
        "Query parameters are invalid",
        parsedQuery.error.flatten(),
      );
    }

    const { range, bucket, format, sensorType, compare } = parsedQuery.data;

    const [existingWell] = await db
      .select({ id: well.id })
      .from(well)
      .where(eq(well.id, wellId))
      .limit(1);

    if (!existingWell) {
      return errorResponse(404, "WELL_NOT_FOUND", "Well not found", { wellId });
    }

    const currentRows = await fetchMetrics(wellId, range, bucket, sensorType);
    let comparisonRows: typeof currentRows = [];

    if (compare) {
      comparisonRows = await fetchMetrics(wellId, range, bucket, sensorType, true);
    }

    if (format === "csv") {
      return new NextResponse(toCsv(currentRows), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="well-${wellId}-metrics.csv"`,
          "Cache-Control": "public, s-maxage=25, stale-while-revalidate=15"
        },
      });
    }

    return NextResponse.json(
      { wellId, range, bucket, rows: currentRows, comparisonRows },
      {
        headers: {
          "Cache-Control": "public, s-maxage=25, stale-while-revalidate=15"
        }
      }
    );
  } catch (error) {
    console.error("[metrics_route_error]", error);
    return errorResponse(500, "INTERNAL_ERROR", "Failed to fetch well metrics");
  }
}
