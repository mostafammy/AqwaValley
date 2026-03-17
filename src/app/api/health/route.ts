import { NextResponse } from "next/server";

import { db } from "~/server/db";
import { sql } from "drizzle-orm";

export async function GET() {
  const start = Date.now();

  let dbOk = false;
  let timescaleOk = false;

  try {
    await db.execute(sql`SELECT 1`);
    dbOk = true;
  } catch {
    // db unreachable
  }

  if (dbOk) {
    try {
      const result = await db.execute(sql`
        SELECT COUNT(*) AS count
        FROM timescaledb_information.hypertables
        WHERE hypertable_name = 'sensor_data'
      `);
      timescaleOk = Number((result[0] as { count: string } | undefined)?.count ?? 0) > 0;
    } catch {
      // timescaledb extension not available
    }
  }

  const latencyMs = Date.now() - start;
  const allOk = dbOk && timescaleOk;

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      checks: {
        db: dbOk,
        timescale: timescaleOk,
      },
      latencyMs,
    },
    { status: allOk ? 200 : 503 },
  );
}
