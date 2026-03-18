import { sql } from "drizzle-orm";

import { db } from "~/server/db";

export type RunBeginResult =
  | { status: "started" }
  | { status: "running" }
  | { status: "failed"; error: string | null }
  | { status: "completed"; response: unknown };

async function ensureRunRegistryTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cron_simulation_run (
      run_key text PRIMARY KEY,
      status text NOT NULL,
      started_at timestamptz NOT NULL DEFAULT NOW(),
      completed_at timestamptz NULL,
      response jsonb NULL,
      error text NULL
    )
  `);
}

export async function beginRun(runKey: string): Promise<RunBeginResult> {
  await ensureRunRegistryTable();

  const inserted = await db.execute(sql`
    INSERT INTO cron_simulation_run (run_key, status)
    VALUES (${runKey}, 'running')
    ON CONFLICT (run_key) DO NOTHING
    RETURNING run_key
  `);

  const insertedRows = (inserted as { rows?: Array<{ run_key: string }> }).rows;
  if (insertedRows && insertedRows.length > 0) {
    return { status: "started" };
  }

  const existing = await db.execute(sql`
    SELECT status, response, error
    FROM cron_simulation_run
    WHERE run_key = ${runKey}
    LIMIT 1
  `);

  const rows = (
    existing as {
      rows?: Array<{ status: string; response: unknown; error: string | null }>;
    }
  ).rows;

  const record = rows?.[0];
  if (!record) {
    return { status: "running" };
  }

  if (record.status === "completed") {
    return { status: "completed", response: record.response ?? null };
  }

  if (record.status === "failed") {
    return { status: "failed", error: record.error ?? null };
  }

  return { status: "running" };
}

export async function completeRun(
  runKey: string,
  response: unknown,
): Promise<void> {
  await ensureRunRegistryTable();

  await db.execute(sql`
    UPDATE cron_simulation_run
    SET
      status = 'completed',
      completed_at = NOW(),
      response = ${JSON.stringify(response)}::jsonb,
      error = NULL
    WHERE run_key = ${runKey}
  `);
}

export async function failRun(
  runKey: string,
  errorMessage: string,
): Promise<void> {
  await ensureRunRegistryTable();

  await db.execute(sql`
    UPDATE cron_simulation_run
    SET
      status = 'failed',
      completed_at = NOW(),
      error = ${errorMessage}
    WHERE run_key = ${runKey}
  `);
}
