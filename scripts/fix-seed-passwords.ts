#!/usr/bin/env tsx
/**
 * scripts/fix-seed-passwords.ts
 *
 * Replaces bcrypt password hashes for @seed.local users with hashes
 * produced by Better Auth's internal scrypt algorithm.
 *
 * Run: pnpm tsx scripts/fix-seed-passwords.ts
 */

import { existsSync, readFileSync } from "fs";
import { eq, sql } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { hashPassword } from "better-auth/crypto";
import * as schema from "../src/server/db/schema";

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    const content = readFileSync(file, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

loadLocalEnv();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("ERROR: DATABASE_URL is required.");
  process.exit(1);
}

const queryClient = postgres(connectionString, { max: 1 });
const db = drizzle(queryClient, { schema });

const SEED_EMAIL_DOMAIN = "seed.local";

async function main() {
  console.log("🔧 Re-hashing passwords for seed users with Better Auth scrypt...");

  const seedUsers = await db
    .select({ id: schema.user.id, username: schema.user.username })
    .from(schema.user)
    .where(sql`${schema.user.email} like ${`%@${SEED_EMAIL_DOMAIN}`}`);

  if (seedUsers.length === 0) {
    console.log("No seed users found.");
    return;
  }

  const hashedPassword = await hashPassword("password123");
  console.log(`  Generated hash for 'password123' (${hashedPassword.length} chars)`);

  let updatedAccounts = 0;
  for (const u of seedUsers) {
    const result = await db
      .update(schema.account)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(schema.account.userId, u.id));
    if (result.count > 0) updatedAccounts += 1;
  }

  console.log(`✅ Updated ${updatedAccounts} account rows for ${seedUsers.length} seed users.`);
  console.log("   Login with any seed user's national ID + password: password123");
}

main()
  .catch((error) => {
    console.error("Fix failed:", error);
    process.exit(1);
  })
  .finally(() => queryClient.end());