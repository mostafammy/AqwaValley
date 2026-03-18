import { sql } from "drizzle-orm";

import { db } from "~/server/db";

export type CronSimulationRunStatus = "running" | "completed" | "failed";

export type CronSimulationRunRecord = {
  runKey: string;
  status: CronSimulationRunStatus;
  startedAt: Date;
  completedAt: Date | null;
  response: unknown;
  error: string | null;
};

export type RunBeginResult =
  | { status: "started" }
  | { status: "running" }
  | { status: "failed"; error: string | null }
  | { status: "completed"; response: unknown };

export type ListRunsFilters = {
  status?: CronSimulationRunStatus;
  from?: Date;
  to?: Date;
  runKey?: string;
  page: number;
  pageSize: number;
};

export type ListRunsResult = {
  rows: CronSimulationRunRecord[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
};

let ensureTablePromise: Promise<void> | null = null;

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }

  const maybeRows = result as { rows?: T[] };
  return maybeRows.rows ?? [];
}

function normalizeDate(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    // Fall back to epoch for unexpected DB coercions to keep API stable.
    return new Date(0);
  }

  return parsed;
}

function normalizeNullableDate(value: unknown): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  return normalizeDate(value);
}

function normalizeInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toRunRecord(row: {
  run_key: string;
  status: string;
  started_at: unknown;
  completed_at: unknown;
  response: unknown;
  error: string | null;
}): CronSimulationRunRecord {
  return {
    runKey: row.run_key,
    status: row.status as CronSimulationRunStatus,
    startedAt: normalizeDate(row.started_at),
    completedAt: normalizeNullableDate(row.completed_at),
    response: row.response,
    error: row.error,
  };
}

function isStale(startedAt: Date, staleTimeoutSeconds: number): boolean {
  return Date.now() - startedAt.getTime() > staleTimeoutSeconds * 1000;
}

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
    .then(async () => {
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS cron_simulation_run_status_started_idx
        ON cron_simulation_run (status, started_at DESC)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS cron_simulation_run_started_idx
        ON cron_simulation_run (started_at DESC)
      `);
    })
    .then(() => undefined);

  await ensureTablePromise;
}

async function reclaimStaleRun(
  runKey: string,
  expectedStartedAt: Date,
): Promise<boolean> {
  const result = await db.execute(sql`
    UPDATE cron_simulation_run
    SET
      status = 'failed',
      completed_at = NOW(),
      error = 'stale_timeout'
    WHERE
      run_key = ${runKey}
      AND status = 'running'
      AND started_at <= ${expectedStartedAt}
    RETURNING run_key
  `);

  return rowsOf<{ run_key: string }>(result).length > 0;
}

export async function beginRun(
  runKey: string,
  staleTimeoutSeconds: number,
): Promise<RunBeginResult> {
  await ensureRunRegistryTable();

  const inserted = await db.execute(sql`
    INSERT INTO cron_simulation_run (run_key, status)
    VALUES (${runKey}, 'running')
    ON CONFLICT (run_key) DO NOTHING
    RETURNING run_key
  `);

  if (rowsOf<{ run_key: string }>(inserted).length > 0) {
    return { status: "started" };
  }

  const currentResult = await db.execute(sql`
    SELECT run_key, status, started_at, completed_at, response, error
    FROM cron_simulation_run
    WHERE run_key = ${runKey}
    LIMIT 1
  `);

  const current = rowsOf<{
    run_key: string;
    status: string;
    started_at: unknown;
    completed_at: unknown;
    response: unknown;
    error: string | null;
  }>(currentResult)[0];

  if (!current) {
    return { status: "running" };
  }

  if (current.status === "completed") {
    return { status: "completed", response: current.response ?? null };
  }

  if (current.status === "failed") {
    return { status: "failed", error: current.error ?? null };
  }

  if (current.status === "running") {
    const currentStartedAt = normalizeDate(current.started_at);

    if (!isStale(currentStartedAt, staleTimeoutSeconds)) {
      return { status: "running" };
    }

    const reclaimed = await reclaimStaleRun(runKey, currentStartedAt);
    if (!reclaimed) {
      return { status: "running" };
    }

    const restarted = await db.execute(sql`
      INSERT INTO cron_simulation_run (run_key, status)
      VALUES (${runKey}, 'running')
      ON CONFLICT (run_key)
      DO UPDATE SET
        status = 'running',
        started_at = NOW(),
        completed_at = NULL,
        response = NULL,
        error = NULL
      WHERE cron_simulation_run.status = 'failed'
      RETURNING run_key
    `);

    if (rowsOf<{ run_key: string }>(restarted).length > 0) {
      return { status: "started" };
    }
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

export async function getRun(
  runKey: string,
): Promise<CronSimulationRunRecord | null> {
  await ensureRunRegistryTable();

  const result = await db.execute(sql`
    SELECT run_key, status, started_at, completed_at, response, error
    FROM cron_simulation_run
    WHERE run_key = ${runKey}
    LIMIT 1
  `);

  const row = rowsOf<{
    run_key: string;
    status: string;
    started_at: unknown;
    completed_at: unknown;
    response: unknown;
    error: string | null;
  }>(result)[0];

  if (!row) return null;
  return toRunRecord(row);
}

export async function listRuns(
  filters: ListRunsFilters,
): Promise<ListRunsResult> {
  await ensureRunRegistryTable();

  const offset = (filters.page - 1) * filters.pageSize;

  const whereClauses = [sql`1=1`];
  if (filters.status) whereClauses.push(sql`status = ${filters.status}`);
  if (filters.runKey) whereClauses.push(sql`run_key = ${filters.runKey}`);
  if (filters.from) whereClauses.push(sql`started_at >= ${filters.from}`);
  if (filters.to) whereClauses.push(sql`started_at <= ${filters.to}`);

  const whereSql = sql.join(whereClauses, sql` AND `);

  const rowsResult = await db.execute(sql`
    SELECT run_key, status, started_at, completed_at, response, error
    FROM cron_simulation_run
    WHERE ${whereSql}
    ORDER BY started_at DESC
    LIMIT ${filters.pageSize}
    OFFSET ${offset}
  `);

  const countResult = await db.execute(sql`
    SELECT COUNT(*)::int AS total
    FROM cron_simulation_run
    WHERE ${whereSql}
  `);

  const rows = rowsOf<{
    run_key: string;
    status: string;
    started_at: unknown;
    completed_at: unknown;
    response: unknown;
    error: string | null;
  }>(rowsResult).map(toRunRecord);

  const total = normalizeInt(
    rowsOf<{ total: unknown }>(countResult)[0]?.total ?? 0,
  );

  return {
    rows,
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    hasNext: filters.page * filters.pageSize < total,
  };
}
