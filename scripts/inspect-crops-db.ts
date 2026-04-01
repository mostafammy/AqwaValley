import { existsSync, readFileSync } from "fs";
import { join } from "path";

function loadLocalEnv() {
  const envPath = join(process.cwd(), ".env");
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf8");
    content.split("\n").forEach((line) => {
      const parts = line.split("=");
      if (parts.length >= 2) {
        const key = parts[0]!.trim();
        const value = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
  process.env.SKIP_ENV_VALIDATION = "true";
}

loadLocalEnv();

async function main() {
  const { db } = await import("../src/server/db");
  const { sql } = await import("drizzle-orm");

  try {
    const tables = ['crop_profile', 'crop_history'];
    for (const table of tables) {
        console.log(`\n🔍 Inspecting table: ${table}`);
        
        // Execute raw SQL using the correctly typed driver response
        const res = await db.execute(sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = ${table}
        `);
        
        // For postgres-js, res might be the array of rows directly
        const rows = (res as any).rows || res;
        
        if (Array.isArray(rows)) {
            console.log('Columns:', rows.map((r: any) => `${r.column_name} (${r.data_type})`));
        } else {
            console.log('No columns found or unexpected response format.');
        }
    }
  } catch (e) {
    console.error("DB Inspection failed:", e);
  } finally {
    process.exit(0);
  }
}

main();
