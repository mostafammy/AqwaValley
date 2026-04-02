import { existsSync, readFileSync } from "fs";
import { join } from "path";

// 1. Force environment loading BEFORE any other imports
const loadEnv = () => {
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
};

loadEnv();

async function run() {
  console.log("🚀 Starting isolated quota backfill...");
  
  // Dynamic imports to ensure loadEnv() has already populated process.env
  const { db } = await import("../src/server/db");
  const { farm, district } = await import("../src/server/db/schema");
  const { computeFarmQuotaDecision, computeDistrictQuotaDecision } = await import("../src/server/services/quotaDecisionService");

  const farms = await db.select({ id: farm.id, name: farm.name }).from(farm);
  const districts = await db.select({ id: district.id }).from(district);

  console.log(`Processing ${farms.length} farms across ${districts.length} districts.`);

  const now = new Date();
  // Fill last 12 months
  for (let i = 0; i < 12; i++) {
    const anchor = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = anchor.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
    console.log(`\n📅 القراءات لشهر: ${monthStr}`);

    for (const f of farms) {
       try {
         await computeFarmQuotaDecision({
           db,
           farmId: f.id,
           periodType: "monthly",
           anchor,
           baselineWindow: 3
         });
         process.stdout.write(".");
       } catch (err) {
         console.error(`\n[ERROR] Farm ${f.name}:`, err);
       }
    }
    
    for (const d of districts) {
      try {
        await computeDistrictQuotaDecision({
          db,
          districtId: d.id,
          periodType: "monthly",
          anchor,
          baselineWindow: 3
        });
        process.stdout.write("D");
      } catch (err) {
         const msg = err instanceof Error ? err.message : String(err);
         console.error(`\n[ERROR] District ${d.id}: ${msg}`);
      }
    }
  }

  console.log("\n\n✅ تم ملء البيانات التاريخية بنجاح!");
  process.exit(0);
}

run().catch(err => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
