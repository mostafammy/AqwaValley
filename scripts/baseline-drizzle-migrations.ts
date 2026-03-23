import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import postgres from "postgres";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx < 0) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed
        .slice(idx + 1)
        .trim()
        .replace(/^['\"]|['\"]$/g, "");
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

function fileHash(filePath: string): string {
  const content = fs.readFileSync(filePath, "utf8");
  return crypto.createHash("sha256").update(content).digest("hex");
}

async function main() {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is missing");
  }

  const sql = postgres(url, { max: 1 });

  const existing =
    await sql`select id, hash, created_at from drizzle.__drizzle_migrations order by id`;
  if (existing.length > 0) {
    console.log(
      "Migration baseline skipped: __drizzle_migrations is not empty.",
    );
    await sql.end();
    return;
  }

  const requiredTables = ["user", "well", "cron_simulation_run"];
  const tableRows = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name = any(${requiredTables}::text[])
  `;

  const existingTables = new Set(tableRows.map((r) => String(r.table_name)));
  const missing = requiredTables.filter((name) => !existingTables.has(name));
  if (missing.length > 0) {
    console.log(
      "Migration baseline skipped: database does not look pre-provisioned.",
      { missing },
    );
    await sql.end();
    return;
  }

  const migrationFiles = [
    "drizzle/0000_conscious_gravity.sql",
    "drizzle/0001_lively_stardust.sql",
  ];

  const now = Date.now();

  for (let i = 0; i < migrationFiles.length; i += 1) {
    const rel = migrationFiles[i]!;
    const abs = path.resolve(rel);
    if (!fs.existsSync(abs)) {
      throw new Error(`Missing migration file: ${rel}`);
    }

    const hash = fileHash(abs);
    await sql`
      insert into drizzle.__drizzle_migrations (hash, created_at)
      values (${hash}, ${now + i})
    `;
    console.log("Baselined migration", rel, hash);
  }

  await sql.end();
  console.log("Baseline complete. You can now run pnpm db:migrate.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
