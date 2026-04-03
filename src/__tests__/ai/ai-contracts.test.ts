import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { generateRuleBasedPlan } from "~/server/services/irrigation/fallback";
import { irrigationPlanSchema } from "~/server/services/irrigation/schemas";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("AI irrigation contract coverage (Invariant #7)", () => {
  it("ai_schema_rejects_malformed_json_and_missing_fields", () => {
    expect(() =>
      irrigationPlanSchema.parse({
        totalLitres: 1200,
        quotaWarning: false,
        zones: [],
      }),
    ).toThrow();

    expect(() =>
      irrigationPlanSchema.parse({
        reasoning: "valid reasoning text for traceability",
        totalLitres: 1200,
        quotaWarning: false,
        zones: [
          {
            zoneId: "00000000-0000-0000-0000-00000000a001",
            cropType: "wheat",
            growthStage: "vegetative",
            recommendedLitres: 500,
            scheduledAt: "5:30",
            confidence: "HIGH",
          },
        ],
      }),
    ).toThrow();
  });

  it("ai_temperature_zero_is_deterministic_for_same_inputs", () => {
    const openRouterSource = readSource("src/server/ai/openrouter-client.ts");

    expect(openRouterSource).toContain("temperature: 0");
    expect(openRouterSource).toContain("callGroq");
    expect(openRouterSource).toContain("callOpenRouter");

    const input = {
      farm: {
        name: "Kharga Demo Farm",
        districtName: "New Valley",
        areaHectares: 5,
      },
      zones: [
        {
          id: "00000000-0000-0000-0000-00000000b001",
          name: "Zone A",
          cropType: "wheat",
          growthStage: "vegetative",
          areaHectares: 2.5,
          irrigationSystem: "drip" as const,
        },
      ],
      quota: {
        monthlyLimit: 100000,
        usedLitres: 40000,
        remainingLitres: 60000,
      },
      soilReading: {
        "00000000-0000-0000-0000-00000000b001": { humidityPct: 40 },
      },
      weather: {
        daily: [{ maxTemp: 34, et0: 7.5, rain: 0 }],
      },
    };

    const result1 = generateRuleBasedPlan(input);
    const result2 = generateRuleBasedPlan(input);

    expect(result1).toEqual(result2);
  });

  it("ai_persists_model_used_and_recommendation_traceability", () => {
    const recommendSource = readSource(
      "src/server/services/irrigation/recommend.ts",
    );

    expect(recommendSource).toContain("modelUsed");
    expect(recommendSource).toContain("rawResponse");
    expect(recommendSource).toContain("systemPrompt");
    expect(recommendSource).toContain("userMessage");
    expect(recommendSource).toContain("fallback");
    expect(recommendSource).toContain(
      "irrigationPlanSchema.parse(JSON.parse(cleaned))",
    );
    expect(recommendSource).toContain('modelUsed = "rule-based-engine"');
  });
});
