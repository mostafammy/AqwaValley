import { sql } from "drizzle-orm";

import { db } from "~/server/db";

export type RunBeginResult =
  | { status: "started" }
  | { status: "running" }
  | { status: "failed"; error: string | null }
  | { status: "completed"; response: unknown };

let ensureTablePromise: Promise<void> | null = null;

async function ensureRunRegistryTable(): Promise<void> {
  ensureTablePromise ??= db
    .execute(
      sql`
      CREATE TABLE IF NOT EXISTS cron_simulation_run (
        run_key text PRIMARY KEY,
        status text NOT NULL,
        started_at timestamptz NOT NULL DEFAULT NOW(),
        completed_at timestamptz NULL,
        response jsonb NULL,
        error text NULL
      )
    `,
    )
    .then(() => undefined);

  await ensureTablePromise;
}

export async function beginRun(runKey: string): Promise<RunBeginResult> {
  await ensureRunRegistryTable();

  const result = await db.execute(sql`
    WITH inserted AS (
      INSERT INTO cron_simulation_run (run_key, status)
      VALUES (${runKey}, 'running')
      ON CONFLICT (run_key) DO NOTHING
      RETURNING status, response, error
    )
    SELECT
      true AS inserted,
      status,
      response,
      error
    FROM inserted
    UNION ALL
    SELECT
      false AS inserted,
      r.status,
      r.response,
      r.error
    FROM cron_simulation_run r
    WHERE r.run_key = ${runKey}
    LIMIT 1
  `);

  const rows = result as unknown as Array<{
    inserted: boolean;
    status: string;
    response: unknown;
    error: string | null;
  }>;

  const record = rows[0];
  if (!record) {
    return { status: "running" };
  }

  if (record.inserted) {
    return { status: "started" };
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
