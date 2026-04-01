import { existsSync, readFileSync } from "fs";

/**
 * Basic environment loader to avoid 'dotenv' dependency
 */
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

loadLocalEnv();

async function main() {
  const { db } = await import("../src/server/db/index");
  const schema = await import("../src/server/db/schema");
  const { eq } = await import("drizzle-orm");

  console.log("🌍 Localizing Crop Database to Arabic...");

  const cropTranslations = [
    { type: "wheat",      arabic: "قمح" },
    { type: "corn",       arabic: "ذرة" },
    { type: "vegetables", arabic: "خضروات" },
    { type: "fruits",     arabic: "فواكه" },
    { type: "cotton",     arabic: "قطن" },
    { type: "sugarcane",  arabic: "قصب السكر" },
    { type: "rice",       arabic: "أرز" },
    { type: "other",      arabic: "أخرى" },
  ];

  const stageTranslations = [
    { stage: "germination", arabic: "الإنبات" },
    { stage: "vegetative",  arabic: "النمو الخضري" },
    { stage: "flowering",   arabic: "الإزهار" },
    { stage: "fruiting",    arabic: "الإثمار" },
    { stage: "maturity",    arabic: "النضج" },
    { stage: "harvest",     arabic: "الحصاد" },
  ];

  for (const t of cropTranslations) {
    await db.update(schema.cropTypeLookup)
      .set({ displayName: t.arabic })
      .where(eq(schema.cropTypeLookup.type, t.type as any));
    console.log(`✅ Updated ${t.type} -> ${t.arabic}`);
  }

  for (const t of stageTranslations) {
    await db.update(schema.growthStageLookup)
      .set({ displayName: t.arabic })
      .where(eq(schema.growthStageLookup.stage, t.stage as any));
    console.log(`✅ Updated ${t.stage} -> ${t.arabic}`);
  }

  console.log("✨ Done! Database is now localized.");
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
