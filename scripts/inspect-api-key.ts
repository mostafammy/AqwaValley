import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import postgres from "postgres";

function loadLocalEnv() {
  const envFiles = [".env.local", ".env"];
  for (const file of envFiles) {
    if (!existsSync(file)) continue;
    const content = readFileSync(file, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const rawValue = trimmed.slice(idx + 1).trim();
      const value = rawValue.replace(/^['\"]|['\"]$/g, "");
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

async function main() {
  const rawKey = process.argv[2];
  if (!rawKey) {
    console.error("Usage: pnpm tsx scripts/inspect-api-key.ts <RAW_API_KEY>");
    process.exit(1);
  }

  loadLocalEnv();

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL missing in .env.local or .env");
    process.exit(1);
  }

  const hash = createHash("sha256").update(rawKey).digest("hex");
  const sql = postgres(process.env.DATABASE_URL);

  const keys = await sql<
    {
      id: string;
      name: string;
      well_id: string | null;
    }[]
  >`select id, name, well_id from api_key where hashed_key = ${hash} and is_active = true`;

  if (keys.length === 0) {
    console.log("No active API key found for this raw key.");
    await sql.end();
    return;
  }

  const key = keys[0]!;
  console.log("Matched API key:", key);

  if (!key.well_id) {
    console.log(
      "This key is not well-scoped. Any active sensor may be accepted.",
    );
    await sql.end();
    return;
  }

  const sensors = await sql<
    {
      id: string;
      type: string;
      unit: string;
      well_id: string;
    }[]
  >`select id, type, unit, well_id from sensors where well_id = ${key.well_id} and is_active = true order by type`;

  console.log("Valid sensors for this key's well:");
  for (const sensor of sensors) {
    console.log(`- ${sensor.id} (${sensor.type}, ${sensor.unit})`);
  }

  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
