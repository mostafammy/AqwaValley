import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "~/server/db";
import { sensorData } from "~/server/db/schema";
import { auth } from "~/server/better-auth";
import { sql } from "drizzle-orm";

// Query for metrics from TimescaleDB using time_bucket
async function fetchMetrics(
  wellId: string,
  rangeHours: number,
  bucketMinutes: number,
) {
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
      AND sd.timestamp >= NOW() - (${rangeHours.toString()} || ' hours')::interval
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
function toCsv(
  rows: Awaited<ReturnType<typeof fetchMetrics>>,
): string {
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
    .transform((v) => parseInt(v ?? "24", 10)),
  bucket: z
    .string()
    .regex(/^\d+m$/)
    .optional()
    .transform((v) => parseInt(v ?? "60", 10)),
  format: z.enum(["json", "csv"]).optional().default("json"),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth check
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: wellId } = await params;

  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = querySchema.safeParse(searchParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { range, bucket, format } = parsed.data;

  const rows = await fetchMetrics(wellId, range, bucket);

  if (format === "csv") {
    return new NextResponse(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="well-${wellId}-metrics.csv"`,
      },
    });
  }

  return NextResponse.json({ wellId, range, bucket, rows });
}
