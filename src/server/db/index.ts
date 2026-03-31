import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "../../env";
import * as schema from "./schema";

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

const conn = globalForDb.conn ?? postgres(env.DATABASE_URL);
if (env.NODE_ENV !== "production") globalForDb.conn = conn;

import { type PgTransaction, type PgQueryResultHKT } from "drizzle-orm/pg-core";
import { type ExtractTablesWithRelations } from "drizzle-orm";

export const db = drizzle(conn, { schema });

/** Exported type for constructor injection in service classes */
export type DrizzleDB = typeof db;

/** Transaction type for service methods */
export type DBTransaction = PgTransaction<
  PgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

/** Common interface for anything that can execute queries (db or tx) */
export type DBConnection = DrizzleDB | DBTransaction;

