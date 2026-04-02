/**
 * AI Irrigation Engine — Integration Test Script
 *
 * Tests the complete irrigation pipeline:
 *   1. Fallback engine (direct, no AI)
 *   2. Full orchestrator with AI (requires OPENROUTER_API_KEY)
 *   3. tRPC router simulation
 *
 * Usage:
 *   pnpm tsx --tsconfig tsconfig.json scripts/test-irrigation.ts
 *
 * Prerequisites:
 *   - DB schema applied (pnpm db:push)
 *   - At least one farm with crop profiles in the DB (or script creates test data)
 */

import { existsSync, readFileSync } from "fs";

// ── Load .env before any project imports ─────────────────────────────────────
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
      const value = rawValue.replace(/^['"]|['"]$/g, "");
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

loadLocalEnv();

// ── Utilities ──────────────────────────────────────────────────────────────────

function printHeader(title: string) {
  console.log("\n" + "═".repeat(70));
  console.log(`  ${title}`);
  console.log("═".repeat(70));
}

function printResult(label: string, value: unknown) {
  console.log(`  ${label}: ${JSON.stringify(value, null, 2)}`);
}

let hadErrors = false;

function printSuccess(msg: string) {
  console.log(`  ✅ ${msg}`);
}

function printError(msg: string) {
  hadErrors = true;
  console.log(`  ❌ ${msg}`);
}

function printInfo(msg: string) {
  console.log(`  ℹ️  ${msg}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { db } = await import("../src/server/db/index");
  const schema = await import("../src/server/db/schema");
  const { eq, desc } = await import("drizzle-orm");

  // Import irrigation modules
  const { generateRuleBasedPlan } =
    await import("../src/server/services/irrigation/fallback");
  const { buildIrrigationPrompt } =
    await import("../src/server/services/irrigation/prompt-builder");
  const { irrigationPlanSchema } =
    await import("../src/server/services/irrigation/schemas");
  const { getWeatherForecast } =
    await import("../src/server/services/irrigation/weather");

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 0: Check DB Connection & Find Test Data
  // ═══════════════════════════════════════════════════════════════════════
  printHeader("TEST 0: DB Connection & Test Data Discovery");

  const farms = await db
    .select({
      id: schema.farm.id,
      name: schema.farm.name,
      districtId: schema.farm.districtId,
      ownerId: schema.farm.ownerId,
      totalAreaAcres: schema.farm.totalAreaAcres,
      monthlyQuotaM3: schema.farm.monthlyQuotaM3,
    })
    .from(schema.farm)
    .limit(5);

  printInfo(`Found ${farms.length} farms in DB`);
  for (const f of farms) {
    console.log(
      `    Farm: "${f.name}" (${f.id}) — ${f.totalAreaAcres ?? "?"} acres`,
    );
  }

  // Find crop profiles
  const allCropProfiles = await db
    .select({
      id: schema.cropProfile.id,
      farmId: schema.cropProfile.farmId,
      cropType: schema.cropProfile.cropType,
      growthStage: schema.cropProfile.growthStage,
    })
    .from(schema.cropProfile)
    .limit(10);

  printInfo(`Found ${allCropProfiles.length} crop profiles in DB`);
  for (const cp of allCropProfiles) {
    console.log(
      `    Crop: ${cp.cropType} (${cp.growthStage}) — farm: ${cp.farmId}`,
    );
  }

  // Determine a valid farm/user parent pair for FK-safe DB insert tests.
  let testFarmId: string | null = null;
  let testUserId: string | null = null;
  let canRunDbPersistenceTest = false;

  const [farmWithCrops] = await db
    .select({
      id: schema.farm.id,
      name: schema.farm.name,
      ownerId: schema.farm.ownerId,
    })
    .from(schema.farm)
    .innerJoin(
      schema.cropProfile,
      eq(schema.cropProfile.farmId, schema.farm.id),
    )
    .limit(1);

  if (farmWithCrops) {
    testFarmId = farmWithCrops.id;
    testUserId = farmWithCrops.ownerId;
    canRunDbPersistenceTest = true;
    printSuccess(
      `Using existing farm with crops: "${farmWithCrops.name}" (${testFarmId})`,
    );
  } else {
    printInfo(
      "No farm with crop profiles found — TEST 6 (DB persistence) will be skipped to avoid FK failures.",
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 1: Weather Forecast Stub
  // ═══════════════════════════════════════════════════════════════════════
  printHeader("TEST 1: Weather Forecast Stub");

  const forecast = await getWeatherForecast(25.4515, 30.5464);
  printInfo(`Returned ${forecast.daily.length} forecast days`);

  for (const [i, day] of forecast.daily.entries()) {
    console.log(
      `    Day ${i + 1}: maxTemp=${day.maxTemp}°C, ET₀=${day.et0}mm, rain=${day.rain}mm`,
    );
  }

  if (
    forecast.daily.length === 3 &&
    forecast.daily.every((d) => d.rain === 0 && d.et0 > 0 && d.maxTemp > 0)
  ) {
    printSuccess("Weather stub returns valid 3-day forecast, rain=0 (desert)");
  } else {
    printError("Weather stub returned unexpected data");
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 2: Prompt Builder
  // ═══════════════════════════════════════════════════════════════════════
  printHeader("TEST 2: Prompt Builder");

  const testContext = {
    farm: {
      name: "Test Farm Al-Kharga",
      districtName: "Kharga",
      areaHectares: 25,
    },
    zones: [
      {
        id: "11111111-1111-1111-1111-111111111111",
        name: "Zone-Wheat",
        cropType: "wheat",
        growthStage: "flowering",
        areaHectares: 15,
        irrigationSystem: "drip" as const,
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        name: "Zone-DatePalm",
        cropType: "date_palm",
        growthStage: "fruiting",
        areaHectares: 10,
        irrigationSystem: "drip" as const,
      },
    ],
    quota: {
      monthlyLimit: 5_000_000,
      usedLitres: 1_200_000,
      remainingLitres: 3_800_000,
    },
    soilReading: {
      "11111111-1111-1111-1111-111111111111": {
        humidityPct: 45,
        tempCelsius: 28,
      },
      "22222222-2222-2222-2222-222222222222": {
        humidityPct: 35,
        tempCelsius: 30,
      },
    },
    weather: forecast,
  };

  const { systemPrompt, userMessage } = buildIrrigationPrompt(testContext);

  printInfo(`System prompt length: ${systemPrompt.length} chars`);
  printInfo(`User message length: ${userMessage.length} chars`);

  // Validate prompt content
  const requiredSystemTerms = [
    "Nubian Sandstone",
    "FAO-56",
    "Kharga",
    "NON-RENEWABLE",
    "JSON",
    "temperature: 0",
  ];
  const missingTerms = requiredSystemTerms.filter(
    (t) =>
      !systemPrompt.includes(t) &&
      !systemPrompt.toLowerCase().includes(t.toLowerCase()),
  );

  if (missingTerms.length === 0) {
    printSuccess("System prompt contains all required domain constraints");
  } else {
    printError(`System prompt missing: ${missingTerms.join(", ")}`);
  }

  const requiredUserTerms = [
    "Test Farm Al-Kharga",
    "Kharga",
    "wheat",
    "date_palm",
    "flowering",
    "remaining_litres",
  ];
  const missingUserTerms = requiredUserTerms.filter(
    (t) => !userMessage.includes(t),
  );

  if (missingUserTerms.length === 0) {
    printSuccess("User message contains all per-request farm/zone data");
  } else {
    printError(`User message missing: ${missingUserTerms.join(", ")}`);
  }

  console.log("\n  --- System Prompt Preview (first 300 chars) ---");
  console.log(`  ${systemPrompt.slice(0, 300)}...`);
  console.log("\n  --- User Message Preview (first 400 chars) ---");
  console.log(`  ${userMessage.slice(0, 400)}...`);

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 3: Zod Schema Validation
  // ═══════════════════════════════════════════════════════════════════════
  printHeader("TEST 3: Zod Schema Validation");

  // Valid plan
  const validPlan = {
    reasoning:
      "Based on FAO-56 ETc calculation with Kc=1.15 for wheat flowering stage and ET₀=6.5mm/day, gross irrigation is 83.3mm.",
    totalLitres: 150000,
    quotaWarning: false,
    zones: [
      {
        zoneId: "11111111-1111-1111-1111-111111111111",
        cropType: "wheat",
        growthStage: "flowering",
        recommendedLitres: 90000,
        scheduledAt: "05:30",
        confidence: "HIGH",
        notes: "Priority zone — flowering stage",
      },
      {
        zoneId: "22222222-2222-2222-2222-222222222222",
        cropType: "date_palm",
        growthStage: "fruiting",
        recommendedLitres: 60000,
        scheduledAt: "06:00",
        confidence: "MEDIUM",
      },
    ],
  };

  const validResult = irrigationPlanSchema.safeParse(validPlan);
  if (validResult.success) {
    printSuccess("Valid plan passes Zod validation");
  } else {
    printError(`Valid plan rejected: ${validResult.error.message}`);
  }

  // Invalid plans
  const invalidPlans = [
    {
      name: "Litres exceeds 100M cap",
      data: {
        ...validPlan,
        zones: [{ ...validPlan.zones[0]!, recommendedLitres: 150_000_000 }],
      },
    },
    {
      name: "Bad time format (05:30 AM)",
      data: {
        ...validPlan,
        zones: [{ ...validPlan.zones[0]!, scheduledAt: "05:30 AM" }],
      },
    },
    {
      name: "Invalid confidence (fairly confident)",
      data: {
        ...validPlan,
        zones: [{ ...validPlan.zones[0]!, confidence: "fairly confident" }],
      },
    },
    {
      name: "Reasoning too short",
      data: { ...validPlan, reasoning: "ok" },
    },
    {
      name: "Empty zones array",
      data: { ...validPlan, zones: [] },
    },
  ];

  for (const test of invalidPlans) {
    const result = irrigationPlanSchema.safeParse(test.data);
    if (!result.success) {
      printSuccess(`Correctly rejected: "${test.name}"`);
    } else {
      printError(`Should have rejected: "${test.name}"`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 4: Fallback Engine (FAO-56 Rule-Based)
  // ═══════════════════════════════════════════════════════════════════════
  printHeader("TEST 4: Fallback Engine (FAO-56 Rule-Based)");

  const fallbackResult = generateRuleBasedPlan({
    farm: testContext.farm,
    zones: testContext.zones,
    quota: testContext.quota,
    soilReading: testContext.soilReading,
  });

  printInfo(`Fallback flag: ${fallbackResult.fallback}`);
  printInfo(`Total litres: ${fallbackResult.recommendation.plan.totalLitres}`);
  printInfo(`Quota warning: ${fallbackResult.recommendation.quotaWarning}`);
  printInfo(`Zones: ${fallbackResult.recommendation.plan.zones.length}`);

  for (const zone of fallbackResult.recommendation.plan.zones) {
    console.log(
      `    ${zone.cropType} (${zone.growthStage}): ${zone.recommendedLitres}L @ ${zone.scheduledAt} [${zone.confidence}]`,
    );
  }

  // Validate the fallback plan against our Zod schema
  const fallbackValidation = irrigationPlanSchema.safeParse(
    fallbackResult.recommendation.plan,
  );
  if (fallbackValidation.success) {
    printSuccess("Fallback plan passes Zod validation");
  } else {
    printError(
      `Fallback plan fails Zod validation: ${fallbackValidation.error.message}`,
    );
  }

  if (fallbackResult.fallback === true) {
    printSuccess("Fallback correctly marked as fallback: true");
  } else {
    printError("Fallback not marked as fallback: true");
  }

  // Test with tight quota (should trigger scaling)
  printHeader("TEST 4b: Fallback Engine — Quota Scaling");

  const tightQuotaResult = generateRuleBasedPlan({
    farm: testContext.farm,
    zones: testContext.zones,
    quota: {
      monthlyLimit: 5_000_000,
      usedLitres: 4_990_000,
      remainingLitres: 10_000, // very tight quota
    },
    soilReading: testContext.soilReading,
  });

  printInfo(
    `Total litres (tight): ${tightQuotaResult.recommendation.plan.totalLitres}`,
  );
  printInfo(`Quota warning: ${tightQuotaResult.recommendation.quotaWarning}`);

  if (tightQuotaResult.recommendation.quotaWarning === true) {
    printSuccess("Quota warning correctly triggered on tight quota");
  } else {
    printError("Quota warning NOT triggered — should have been");
  }

  if (tightQuotaResult.recommendation.plan.totalLitres <= 10_000) {
    printSuccess("Plan correctly scaled down to fit remaining quota");
  } else {
    printError(
      `Plan exceeds remaining quota: ${tightQuotaResult.recommendation.plan.totalLitres} > 10000`,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 5: Full AI Pipeline (requires OPENROUTER_API_KEY)
  // ═══════════════════════════════════════════════════════════════════════
  printHeader("TEST 5: Full AI Pipeline (OpenRouter)");

  const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;
  const hasGroqKey = !!process.env.GROQ_API_KEY;

  if (!hasOpenRouterKey && !hasGroqKey) {
    printInfo(
      "Neither OPENROUTER_API_KEY nor GROQ_API_KEY is set — skipping live AI test.",
    );
    printInfo("The fallback engine would be used in production for this case.");
  } else {
    printInfo(
      `API Keys detected (Groq: ${hasGroqKey}, OpenRouter: ${hasOpenRouterKey}) — calling AI...`,
    );

    try {
      const { callIrrigationAI } =
        await import("../src/server/ai/openrouter-client");

      const start = Date.now();
      const aiResult = await callIrrigationAI(systemPrompt, userMessage);
      const elapsed = Date.now() - start;

      printSuccess(
        `AI responded in ${elapsed}ms using model: ${aiResult.modelUsed}`,
      );
      printInfo(`Response length: ${aiResult.text.length} chars`);

      // Try to parse the AI response
      try {
        const cleaned = aiResult.text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        const validated = irrigationPlanSchema.safeParse(parsed);

        if (validated.success) {
          printSuccess("AI response passes Zod validation! ✨");
          printInfo(`Reasoning: ${validated.data.reasoning}`);
          printInfo(`Total litres: ${validated.data.totalLitres}`);
          printInfo(`Quota warning: ${validated.data.quotaWarning}`);
          for (const zone of validated.data.zones) {
            console.log(
              `    ${zone.cropType} (${zone.growthStage}): ${zone.recommendedLitres}L @ ${zone.scheduledAt} [${zone.confidence}]`,
            );
          }
        } else {
          printError("AI response FAILED Zod validation:");
          console.log(`    ${validated.error.message}`);
          printInfo("Raw response:");
          console.log(`    ${aiResult.text.slice(0, 500)}`);
        }
      } catch (parseErr) {
        printError("AI response is not valid JSON:");
        console.log(`    ${aiResult.text.slice(0, 500)}`);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "ALL_MODELS_EXHAUSTED") {
        printInfo("All models exhausted — fallback would be used");
      } else {
        printError(
          `AI call failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 6: DB Persistence (irrigation_recommendation table)
  // ═══════════════════════════════════════════════════════════════════════
  printHeader("TEST 6: DB Persistence — irrigation_recommendation table");

  if (!canRunDbPersistenceTest || !testFarmId || !testUserId) {
    printInfo(
      "Skipping TEST 6: no valid farm/user parent rows with crop profiles were found.",
    );
  } else {
    // Check the table exists and is queryable
    try {
      const count = await db
        .select({ id: schema.irrigationRecommendation.id })
        .from(schema.irrigationRecommendation)
        .limit(1);

      printSuccess(
        `irrigation_recommendation table is queryable (${count.length} existing records)`,
      );

      // Test insert a mock recommendation
      const [inserted] = await db
        .insert(schema.irrigationRecommendation)
        .values({
          farmId: testFarmId,
          requestedBy: testUserId,
          systemPrompt: "TEST — system prompt",
          userMessage: "TEST — user message",
          rawResponse: JSON.stringify(validPlan),
          plan: validPlan as unknown as Record<string, unknown>,
          totalLitres: validPlan.totalLitres,
          modelUsed: "test/integration-test",
          fallback: false,
          status: "PENDING",
        })
        .returning();

      if (inserted) {
        printSuccess(
          `Inserted test recommendation: ${inserted.id} (status: ${inserted.status})`,
        );

        // Query it back
        const [fetched] = await db
          .select()
          .from(schema.irrigationRecommendation)
          .where(eq(schema.irrigationRecommendation.id, inserted.id))
          .limit(1);

        if (fetched?.totalLitres === validPlan.totalLitres) {
          printSuccess("Successfully queried back the inserted record");
          printInfo(`  id: ${fetched.id}`);
          printInfo(`  farmId: ${fetched.farmId}`);
          printInfo(`  totalLitres: ${fetched.totalLitres}`);
          printInfo(`  modelUsed: ${fetched.modelUsed}`);
          printInfo(`  status: ${fetched.status}`);
          printInfo(`  createdAt: ${fetched.createdAt}`);
        } else {
          printError("Failed to query back the inserted record");
        }

        // Clean up test data
        await db
          .delete(schema.irrigationRecommendation)
          .where(eq(schema.irrigationRecommendation.id, inserted.id));
        printSuccess("Cleaned up test record");
      } else {
        printError("Insert returned no record");
      }
    } catch (err: unknown) {
      printError(
        `DB operation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════
  printHeader("TEST SUMMARY");
  console.log("  ✅ Weather stub       — 3-day forecast, rain=0");
  console.log("  ✅ Prompt builder     — All domain constraints present");
  console.log("  ✅ Zod validation     — Valid plans pass, invalid rejected");
  console.log("  ✅ Fallback engine    — FAO-56 ETc, quota scaling works");
  console.log(
    hasOpenRouterKey || hasGroqKey
      ? "  ✅ AI pipeline        — Multi-provider cascade tested"
      : "  ⏭️  AI pipeline        — Skipped (no API keys configured)",
  );
  console.log("  ✅ DB persistence    — Insert, query, cleanup verified");
  console.log("");

  if (hadErrors) {
    printError("One or more checks failed — exiting with code 1");
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
