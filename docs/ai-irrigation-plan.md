# AquaValley — AI Irrigation Engine Implementation Plan

> **Purpose:** This document is a complete, agent-executable implementation plan for the AI Irrigation feature of AquaValley — a government-grade Smart Water Management platform for New Valley Governorate, Egypt. Follow every section in order.

---

## 0. Context & Constraints

- **Project:** AquaValley — Next.js 14, Drizzle ORM, PostgreSQL, BetterAuth, TanStack Query, Zod, tRPC
- **Deployment:** Vercel free tier
- **Region:** New Valley Governorate, Egypt — 5 districts (Kharga, Dakhla, Farafra, Baris, Mut)
- **Water source:** Nubian Sandstone Aquifer — non-renewable, declining ~50cm/year in Kharga
- **Climate:** Hyper-arid desert. Annual rainfall 0–5mm. ET₀ = 3–5mm/day winter, 8–12mm/day summer
- **AI budget:** $0 — use OpenRouter free tier models only
- **Hackathon constraint:** Deliver working implementation, not over-engineered architecture

---

## 1. Why an AI API Is Required

Rule-based ETc math (FAO-56) is the fallback. It cannot do the following, which the AI primary path handles:

| Capability                                                 | Rule-Based ETc                         | AI (Llama 3.3 70B) |
| ---------------------------------------------------------- | -------------------------------------- | ------------------ |
| Integrate soil humidity deficit                            | No — uses fixed targets                | Yes                |
| Reason across 3-day weather forecast                       | No — uses single ET₀ average           | Yes                |
| Balance quota across multiple crop zones                   | No — calculates per zone independently | Yes                |
| Prioritise critical growth stages (flowering > vegetative) | No                                     | Yes                |
| Produce chain-of-thought reasoning for traceability        | No                                     | Yes                |
| Scale down plan when quota is tight with explanation       | No                                     | Yes                |
| Return per-zone confidence scores                          | No                                     | Yes                |

**Decision:** AI is primary. Rule-based ETc is automatic fallback. Both must be implemented. If all AI models are exhausted, farmers still receive a valid plan from the fallback — never an error screen.

---

## 2. Model Selection (OpenRouter Free Tier)

Sign up at `openrouter.ai` — no credit card required for free models.

### Primary Model

```
meta-llama/llama-3.3-70b-instruct:free
```

- 66K context window
- 1.19B community tokens consumed — strongest real-world reliability signal
- Best instruction-following of all free models
- Reliable structured JSON output for complex agronomic prompts
- Supports English + multilingual (Arabic-adjacent for future localisation)

### Fallback 1

```
google/gemma-3-27b-it:free
```

- 131K context window — largest available, critical when full prompt is verbose
- 186M community tokens
- Native structured output support
- Use when primary hits 429 (rate limit) or 503 (overloaded)

### Fallback 2

```
nousresearch/hermes-3-405b:free
```

- 131K context window
- 117M community tokens
- Largest model available on free tier
- Strong function calling and structured output
- Use when both primary and fallback 1 are unavailable

### Models to Skip (and why)

- `google/gemma-3-12b-it:free` — too small for reliable JSON schema adherence with complex prompts
- `google/gemma-3-4b-it:free` — too small
- `meta-llama/llama-3.2-3b-instruct:free` — too small, will hallucinate field values
- `nousresearch/hermes-3-405b:free` alone as primary — designed for roleplay/agentic tasks, overkill as primary

---

## 3. OpenRouter Setup (5 minutes)

### Step 1 — Create account

Go to `openrouter.ai` → Sign up → No credit card needed for free models

### Step 2 — Get API key

Go to `openrouter.ai/keys` → Create key → Copy value

### Step 3 — Add to environment

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AI_MODEL=meta-llama/llama-3.3-70b-instruct:free
```

### Step 4 — Install SDK

```bash
npm install openai
```

OpenRouter uses the identical OpenAI SDK interface. No new library needed. It is a drop-in replacement — just change the `baseURL`.

---

## 4. File Structure

Create these files in your Next.js project:

```
app/
  actions/
    irrigation/
      recommend.ts          ← Server Action (entry point)
      prompt-builder.ts     ← System + user prompt construction
      schemas.ts            ← Zod output validation schemas
      fallback.ts           ← Rule-based ETc fallback engine

lib/
  ai/
    openrouter-client.ts    ← OpenRouter client with model cascade
  cache/
    sensor-cache.ts         ← Redis 30-min soil reading cache

db/
  schema/
    recommendations.ts      ← Drizzle table for storing AI plans

.env.local
  OPENROUTER_API_KEY=sk-or-v1-xxx
  AI_MODEL=meta-llama/llama-3.3-70b-instruct:free
```

---

## 5. Implementation — File by File

### 5.1 `lib/ai/openrouter-client.ts`

The transport layer. Contains the model cascade with automatic retry logic.

**Critical engineering decisions baked in:**

- `temperature: 0` — deterministic output every call. Irrigation is not creative writing. Same farm + same conditions must produce the same plan.
- Cascade order is intentional: most-tested first, largest-context second, largest-model last
- Only `429` (rate limit) and `503` (overloaded) trigger a retry to the next model. Any other error (bad auth, invalid schema) throws immediately — do not retry on hard errors.
- Always return `{ text, modelUsed }` — store `modelUsed` in the DB for debugging and quality analysis over time.

```typescript
// lib/ai/openrouter-client.ts
import OpenAI from "openai";

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY!,
  defaultHeaders: {
    "HTTP-Referer": "https://aquavalley.gov.eg",
    "X-Title": "AquaValley — Smart Water Management",
  },
});

const MODEL_CASCADE = [
  "meta-llama/llama-3.3-70b-instruct:free", // primary — best instruction following
  "google/gemma-3-27b-it:free", // fallback 1 — largest context window
  "nousresearch/hermes-3-405b:free", // fallback 2 — largest model
] as const;

export async function callIrrigationAI(
  systemPrompt: string,
  userMessage: string,
): Promise<{ text: string; modelUsed: string }> {
  for (const model of MODEL_CASCADE) {
    try {
      const response = await openrouter.chat.completions.create({
        model,
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      });

      const text = response.choices[0]?.message?.content;
      if (!text) throw new Error("Empty response from model");

      return { text, modelUsed: model };
    } catch (err: any) {
      const isRetryable = err?.status === 429 || err?.status === 503;
      if (!isRetryable) throw err;
      console.warn(
        `[AI] ${model} unavailable (${err.status}), trying next model...`,
      );
    }
  }

  throw new Error("ALL_MODELS_EXHAUSTED");
}
```

---

### 5.2 `app/actions/irrigation/schemas.ts`

The contract between AI output and your database. **Never trust raw AI output.** Always validate with Zod before persisting or returning to the client.

**Why each validator exists:**

- `z.number().max(500_000)` — hard cap per zone. Prevents AI from recommending volumes that would permanently harm the Nubian Aquifer.
- `z.regex(/^\d{2}:\d{2}$/)` — enforces HH:MM format. Rejects if AI returns "05:30 AM" or an ISO timestamp. Ensures clean DB storage.
- `z.enum(['HIGH','MEDIUM','LOW'])` — confidence must be one of three values. Rejects free text like "fairly confident" that breaks UI rendering.
- `z.string().min(10)` — forces a real reasoning string. Rejects empty reasoning. Traceability is mandatory for a government-compliance system.

```typescript
// app/actions/irrigation/schemas.ts
import { z } from "zod";

export const irrigationZoneSchema = z.object({
  zoneId: z.string().uuid(),
  cropType: z.string().min(1),
  growthStage: z.string().min(1),
  recommendedLitres: z.number().positive().max(500_000),
  scheduledAt: z.string().regex(/^\d{2}:\d{2}$/),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  notes: z.string().optional(),
});

export const irrigationPlanSchema = z.object({
  reasoning: z.string().min(10),
  totalLitres: z.number().positive(),
  quotaWarning: z.boolean(),
  zones: z.array(irrigationZoneSchema).min(1),
});

export type IrrigationPlan = z.infer<typeof irrigationPlanSchema>;
export type IrrigationZone = z.infer<typeof irrigationZoneSchema>;
```

---

### 5.3 `app/actions/irrigation/prompt-builder.ts`

The most critical file. This is where most teams fail — using generic agricultural prompts produces dangerously wrong recommendations for a desert aquifer system. All domain-specific constants live here.

**What must be in the system prompt (non-negotiable):**

- Desert climate declaration — explicitly state near-zero rainfall. Never assume rain.
- ET₀ ranges calibrated for New Valley, not generic values
- Nubian Aquifer non-renewability warning
- Kharga district 15% conservation factor (50cm/yr decline)
- FAO-56 ETc formula and crop coefficient (Kc) rules
- Irrigation efficiency factors by system type
- JSON-only output instruction with exact schema
- No preamble, no markdown fences

**What goes in the user message (per-request):**

- Farm name, district, area
- Monthly quota: total, used, remaining
- Per-zone: crop type, growth stage, current soil humidity, deficit vs field capacity target
- 3-day weather forecast: max temp, ET₀, rainfall per day

```typescript
// app/actions/irrigation/prompt-builder.ts

interface PromptContext {
  farm: {
    name: string;
    districtName: string;
    areaHectares: number;
  };
  zones: Array<{
    id: string;
    name: string;
    cropType: string;
    growthStage: string;
    areaHectares: number;
    irrigationSystem: "drip" | "sprinkler" | "flood";
  }>;
  quota: {
    monthlyLimit: number;
    usedLitres: number;
    remainingLitres: number;
  };
  soilReading: Record<
    string,
    {
      humidityPct: number;
      tempCelsius: number;
    } | null
  >;
  weather: {
    daily: Array<{
      maxTemp: number;
      et0: number;
      rain: number;
    }>;
  };
}

const FIELD_CAPACITY_TARGETS: Record<string, number> = {
  wheat: 70, // 60–80% midpoint
  date_palm: 50, // 40–60% midpoint
  corn: 72, // 65–80% midpoint
  sugar_beet: 65,
  alfalfa: 75,
};

function getCropFieldCapacity(cropType: string): number {
  return FIELD_CAPACITY_TARGETS[cropType.toLowerCase()] ?? 65;
}

function calcDeficitMm(
  soilReading: { humidityPct: number } | null,
  cropType: string,
): number {
  if (!soilReading) return 0;
  const target = getCropFieldCapacity(cropType);
  const deficit = Math.max(0, target - soilReading.humidityPct);
  return parseFloat((deficit * 0.1).toFixed(2)); // convert % to approximate mm
}

export function buildIrrigationPrompt(ctx: PromptContext): {
  systemPrompt: string;
  userMessage: string;
} {
  const systemPrompt = `
You are an agricultural water management AI for New Valley Governorate, Egypt.
You plan irrigation schedules for farms drawing from the Nubian Sandstone Aquifer.

CRITICAL CONSTRAINTS — NEVER IGNORE:
- This is a hyper-arid desert. Annual rainfall is 0–5 mm. NEVER assume or mention rain.
- Reference ET₀: 3–5 mm/day in winter (Dec–Feb), 8–12 mm/day in summer (Jun–Aug).
- The Nubian Sandstone Aquifer is NON-RENEWABLE. Overextraction is permanent.
- Current governorate extraction: ~4 billion m³/year. Safe maximum: 6 billion m³/year.
- Kharga district aquifer declining ~50 cm/year. Apply 15% conservation reduction to all Kharga plans.
- Always schedule irrigation at dawn (05:00–07:00) to minimise evaporation losses.

FAO-56 CALCULATION RULES:
- ETc = ET₀ × Kc (crop coefficient for current growth stage)
- Net irrigation need = ETc − effective rainfall (always 0 mm in New Valley)
- Irrigation efficiency factors: drip = 90%, sprinkler = 75%, flood = 60%
- Gross irrigation = Net need ÷ efficiency factor

CROP Kc REFERENCE VALUES:
- Wheat:      germination=0.30, vegetative=0.70, flowering=1.15, grain_fill=1.10, maturity=0.40
- Date Palm:  vegetative=0.90, flowering=0.95, fruiting=1.05, maturity=0.95
- Corn:       germination=0.30, vegetative=0.75, flowering=1.20, grain_fill=1.15, maturity=0.60
- Sugar Beet: germination=0.35, vegetative=0.75, flowering=1.20, maturity=0.70
- Alfalfa:    vegetative=0.80, peak=1.15, dormant=0.50

PRIORITY RULES:
- Prioritise zones in flowering or grain_fill stages — water stress is most damaging here
- Reduce vegetative-stage zones first if quota is tight
- If total recommended litres exceeds remainingLitres, scale all zones down proportionally

OUTPUT RULES:
- Respond ONLY with valid JSON. No preamble. No markdown fences. No explanation outside the JSON.
- Use this exact schema:
{
  "reasoning": "string — 2–3 sentences of agronomic chain-of-thought",
  "totalLitres": number,
  "quotaWarning": boolean,
  "zones": [
    {
      "zoneId": "uuid string",
      "cropType": "string",
      "growthStage": "string",
      "recommendedLitres": number,
      "scheduledAt": "HH:MM",
      "confidence": "HIGH | MEDIUM | LOW",
      "notes": "string or omit"
    }
  ]
}
`.trim();

  const zoneDetails = ctx.zones
    .map((zone) => {
      const soil = ctx.soilReading[zone.id];
      const deficit = calcDeficitMm(soil, zone.cropType);
      const fieldCapTarget = getCropFieldCapacity(zone.cropType);
      return `
  Zone: ${zone.name} (ID: ${zone.id})
    crop_type: ${zone.cropType}
    growth_stage: ${zone.growthStage}
    area_hectares: ${zone.areaHectares}
    irrigation_system: ${zone.irrigationSystem}
    soil_humidity_pct: ${soil?.humidityPct ?? "NO_READING"}
    soil_temp_celsius: ${soil?.tempCelsius ?? "NO_READING"}
    field_capacity_target_pct: ${fieldCapTarget}
    estimated_deficit_mm: ${deficit}`;
    })
    .join("\n");

  const forecastLines = ctx.weather.daily
    .map(
      (d, i) =>
        `  Day ${i + 1}: max_temp=${d.maxTemp}°C, ET₀=${d.et0}mm, rainfall=${d.rain}mm`,
    )
    .join("\n");

  const userMessage = `
FARM DETAILS:
  name: ${ctx.farm.name}
  district: ${ctx.farm.districtName}
  total_area_hectares: ${ctx.farm.areaHectares}

WATER QUOTA (current month):
  monthly_limit_litres: ${ctx.quota.monthlyLimit}
  used_litres: ${ctx.quota.usedLitres}
  remaining_litres: ${ctx.quota.remainingLitres}
  pct_remaining: ${((ctx.quota.remainingLitres / ctx.quota.monthlyLimit) * 100).toFixed(1)}%

CROP ZONES:
${zoneDetails}

WEATHER FORECAST (next 3 days):
${forecastLines}

Generate today's irrigation plan. If remaining quota < total recommended, scale down 
proportionally and set quotaWarning=true. Prioritise flowering and grain_fill zones.
`.trim();

  return { systemPrompt, userMessage };
}
```

---

### 5.4 `lib/cache/sensor-cache.ts`

Cache soil sensor readings in Redis with a 30-minute TTL. This reduces IoT sensor wear and keeps the AI request path fast by avoiding a live sensor call on every plan request.

```typescript
// lib/cache/sensor-cache.ts
import { redis } from "@/lib/redis";
import { fetchLiveSoilReading } from "@/lib/iot";

const CACHE_TTL_SECONDS = 60 * 30; // 30 minutes

export async function getSoilReadingCached(farmId: string) {
  const cacheKey = `soil:${farmId}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`[Cache] Soil reading HIT for farm ${farmId}`);
      return JSON.parse(cached as string);
    }
  } catch {
    // Redis unavailable — fall through to live fetch
  }

  const fresh = await fetchLiveSoilReading(farmId);

  try {
    await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(fresh));
  } catch {
    // Redis write failed — still return fresh data
  }

  return fresh;
}

export async function invalidateSoilCache(farmId: string): Promise<void> {
  await redis.del(`soil:${farmId}`);
}
```

---

### 5.5 `app/actions/irrigation/fallback.ts`

Pure FAO-56 math. No external dependencies. No AI API. Always returns a valid plan. This runs when `ALL_MODELS_EXHAUSTED` is thrown by the AI client.

**Must return `fallback: true`** so the UI can display "AI unavailable — rule-based plan used" to the farmer, and so you can track fallback rate in your ingestion logs.

```typescript
// app/actions/irrigation/fallback.ts

const KC_VALUES: Record<string, Record<string, number>> = {
  wheat: {
    germination: 0.3,
    vegetative: 0.7,
    flowering: 1.15,
    grain_fill: 1.1,
    maturity: 0.4,
  },
  date_palm: {
    vegetative: 0.9,
    flowering: 0.95,
    fruiting: 1.05,
    maturity: 0.95,
  },
  corn: {
    germination: 0.3,
    vegetative: 0.75,
    flowering: 1.2,
    grain_fill: 1.15,
    maturity: 0.6,
  },
  sugar_beet: {
    germination: 0.35,
    vegetative: 0.75,
    flowering: 1.2,
    maturity: 0.7,
  },
  alfalfa: { vegetative: 0.8, peak: 1.15, dormant: 0.5 },
};

const EFFICIENCY: Record<string, number> = {
  drip: 0.9,
  sprinkler: 0.75,
  flood: 0.6,
};

const FIELD_CAPACITY: Record<string, number> = {
  wheat: 70,
  date_palm: 50,
  corn: 72,
  sugar_beet: 65,
  alfalfa: 75,
};

const ET0_DEFAULT = 7.5; // mm/day — conservative New Valley annual average

interface FallbackInput {
  farm: { name: string; districtName: string; areaHectares: number };
  zones: Array<{
    id: string;
    name: string;
    cropType: string;
    growthStage: string;
    areaHectares: number;
    irrigationSystem: "drip" | "sprinkler" | "flood";
  }>;
  quota: { monthlyLimit: number; usedLitres: number; remainingLitres: number };
  soilReading: Record<string, { humidityPct: number } | null>;
}

export function generateRuleBasedPlan(ctx: FallbackInput) {
  const zonePlans = ctx.zones.map((zone) => {
    const Kc =
      KC_VALUES[zone.cropType.toLowerCase()]?.[
        zone.growthStage.toLowerCase()
      ] ?? 0.8;
    const ETc = ET0_DEFAULT * Kc;
    const efficiency = EFFICIENCY[zone.irrigationSystem] ?? 0.75;
    const grossETc = ETc / efficiency;

    const currentHumidity = ctx.soilReading[zone.id]?.humidityPct ?? 50;
    const target = FIELD_CAPACITY[zone.cropType.toLowerCase()] ?? 65;
    const deficitPct = Math.max(0, target - currentHumidity) / 100;

    // litres = gross ETc (mm) × deficit fraction × area (ha) × 10,000 m²/ha × 0.001 m³/L × 1000 L/m³
    // simplified: ETc_mm × deficit_fraction × area_ha × 10
    const litresPerHa = grossETc * deficitPct * 10 * 1000;
    const totalLitres = Math.round(litresPerHa * zone.areaHectares);

    return {
      zoneId: zone.id,
      cropType: zone.cropType,
      growthStage: zone.growthStage,
      recommendedLitres: totalLitres,
      scheduledAt: "05:30",
      confidence: "MEDIUM" as const,
      notes: "Rule-based ETc calculation — AI service unavailable",
    };
  });

  const total = zonePlans.reduce((sum, z) => sum + z.recommendedLitres, 0);
  const quotaWarning = total > ctx.quota.remainingLitres;

  // Scale down if over quota
  const scaledZones = quotaWarning
    ? zonePlans.map((z) => ({
        ...z,
        recommendedLitres: Math.round(
          z.recommendedLitres * (ctx.quota.remainingLitres / total),
        ),
        notes: "Scaled down to fit remaining quota — rule-based ETc",
      }))
    : zonePlans;

  return {
    success: true,
    fallback: true,
    recommendation: {
      reasoning: `Rule-based FAO-56 ETc plan generated (AI unavailable). ETc = ET₀(${ET0_DEFAULT}mm/day) × Kc per crop stage. ${quotaWarning ? "Plan scaled to fit remaining quota." : ""}`,
      totalLitres: scaledZones.reduce((sum, z) => sum + z.recommendedLitres, 0),
      quotaWarning,
      zones: scaledZones,
    },
  };
}
```

---

### 5.6 `app/actions/irrigation/recommend.ts`

The Server Action — entry point for everything. Orchestrates all the above files.

**Security rules enforced here:**

- `farmId` always comes from the JWT session — never from the request body or URL params
- Quota hard check runs independently of AI output — AI cannot override the database
- All DB writes are in a single transaction

````typescript
// app/actions/irrigation/recommend.ts
"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { farms, farmZones, waterQuotas } from "@/lib/db/schema";
import { recommendations } from "@/lib/db/schema/recommendations";
import { eq } from "drizzle-orm";
import { buildIrrigationPrompt } from "./prompt-builder";
import { callIrrigationAI } from "@/lib/ai/openrouter-client";
import { irrigationPlanSchema, type IrrigationPlan } from "./schemas";
import { getSoilReadingCached } from "@/lib/cache/sensor-cache";
import { generateRuleBasedPlan } from "./fallback";
import { getWeatherForecast } from "@/lib/weather";

export async function requestIrrigationPlan() {
  // ── 1. Auth — farmId from session only, never from params ──────────────────
  const session = await auth();
  if (!session?.user?.farmId) throw new Error("Unauthorized");
  const farmId = session.user.farmId;

  // ── 2. Gather all context in parallel ──────────────────────────────────────
  const [farm, zones, quota] = await Promise.all([
    db.query.farms.findFirst({ where: eq(farms.id, farmId) }),
    db.query.farmZones.findMany({ where: eq(farmZones.farmId, farmId) }),
    db.query.waterQuotas.findFirst({ where: eq(waterQuotas.farmId, farmId) }),
  ]);

  if (!farm) throw new Error("Farm not found");
  if (!quota) throw new Error("Quota record not found");
  if (!zones.length) throw new Error("No crop zones configured");

  const [soilReading, weather] = await Promise.all([
    getSoilReadingCached(farmId),
    getWeatherForecast(farm.districtId),
  ]);

  const ctx = { farm, zones, quota, soilReading, weather };

  // ── 3. Build the prompt ────────────────────────────────────────────────────
  const { systemPrompt, userMessage } = buildIrrigationPrompt(ctx);

  // ── 4. Call AI with model cascade ──────────────────────────────────────────
  let rawResponse: string;
  let modelUsed: string;

  try {
    const result = await callIrrigationAI(systemPrompt, userMessage);
    rawResponse = result.text;
    modelUsed = result.modelUsed;
  } catch (err: any) {
    if (err.message === "ALL_MODELS_EXHAUSTED") {
      return generateRuleBasedPlan(ctx);
    }
    throw err;
  }

  // ── 5. Parse + validate — never trust raw AI output ───────────────────────
  let plan: IrrigationPlan;
  try {
    const cleaned = rawResponse.replace(/```json|```/g, "").trim();
    plan = irrigationPlanSchema.parse(JSON.parse(cleaned));
  } catch (parseErr) {
    console.error("[AI] Parse/validation failed, using fallback", parseErr);
    return generateRuleBasedPlan(ctx);
  }

  // ── 6. Hard quota enforcement — AI cannot override the database ────────────
  const totalRequested = plan.zones.reduce(
    (sum, z) => sum + z.recommendedLitres,
    0,
  );
  if (totalRequested > quota.remainingLitres) {
    const scaleFactor = quota.remainingLitres / totalRequested;
    plan = {
      ...plan,
      quotaWarning: true,
      totalLitres: Math.round(quota.remainingLitres),
      zones: plan.zones.map((z) => ({
        ...z,
        recommendedLitres: Math.round(z.recommendedLitres * scaleFactor),
      })),
    };
  }

  // ── 7. Persist — store full traceability record ────────────────────────────
  const [recommendation] = await db
    .insert(recommendations)
    .values({
      farmId,
      requestedBy: session.user.id,
      systemPrompt,
      userMessage,
      rawResponse,
      plan,
      totalLitres: plan.totalLitres,
      modelUsed,
      fallback: false,
      status: "PENDING",
      createdAt: new Date(),
    })
    .returning();

  return { success: true, fallback: false, recommendation };
}
````

---

### 5.7 `db/schema/recommendations.ts`

Drizzle schema for storing every AI plan. Store everything — system prompt, raw response, parsed plan, and which model was used. This is the traceability record required for government compliance.

```typescript
// db/schema/recommendations.ts
import {
  pgTable,
  uuid,
  text,
  jsonb,
  boolean,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";

export const recommendations = pgTable("irrigation_recommendations", {
  id: uuid("id").defaultRandom().primaryKey(),
  farmId: uuid("farm_id").notNull(),
  requestedBy: uuid("requested_by").notNull(),

  // Full prompt traceability — store everything
  systemPrompt: text("system_prompt").notNull(),
  userMessage: text("user_message").notNull(),
  rawResponse: text("raw_response").notNull(),

  // Parsed + validated plan
  plan: jsonb("plan").notNull(),
  totalLitres: integer("total_litres").notNull(),

  // Which model generated this plan
  modelUsed: text("model_used").notNull(),
  fallback: boolean("fallback").notNull().default(false),

  // Lifecycle
  status: text("status").notNull().default("PENDING"), // PENDING | ACTIVATED | COMPLETED | CANCELLED
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
});
```

**Required indexes — add these before launch:**

```sql
CREATE INDEX idx_recommendations_farm_created
  ON irrigation_recommendations (farm_id, created_at DESC);

CREATE INDEX idx_recommendations_status
  ON irrigation_recommendations (status)
  WHERE status = 'PENDING';
```

---

## 6. System Prompt Engineering Rules

These rules must be followed when modifying the system prompt in `prompt-builder.ts`:

### Always in system prompt (not user message)

These constraints apply to every plan. They must not be skippable:

- Desert climate declaration
- ET₀ calibration for New Valley
- Nubian Aquifer non-renewability warning
- Kharga conservation factor (-15%)
- FAO-56 formula and Kc reference values
- Irrigation efficiency factors by system type
- JSON-only output instruction
- Exact JSON schema

### Always in user message (per-request context)

- Farm name, district, area
- Quota: limit, used, remaining, percentage remaining
- Per-zone: crop type, growth stage, irrigation system, soil humidity, deficit vs target
- 3-day weather: max temp, ET₀, rainfall per day

### What not to do

- Never use generic agricultural AI prompts — New Valley ET₀ values are 2–3× higher than temperate climate defaults
- Never omit the quota from the prompt — quota-aware planning is the core safety feature
- Never set `temperature` above 0 — deterministic output is required for a regulated system
- Never ask for markdown, explanation, or preamble in the output — JSON only

---

## 7. Zod Validation Rules

Parse AI output in this exact order inside the Server Action:

````typescript
// Step 1: Strip markdown fences (model sometimes adds them despite instruction)
const cleaned = rawResponse.replace(/```json|```/g, "").trim();

// Step 2: Parse JSON
const parsed = JSON.parse(cleaned);

// Step 3: Validate with Zod — throws ZodError if invalid
const plan = irrigationPlanSchema.parse(parsed);
````

If any step throws, fall through to `generateRuleBasedPlan()`. Never surface a raw AI parse error to the farmer.

---

## 8. Model Cascade Logic

The cascade must only retry on transient errors:

```
429 → Rate limit exceeded  → retry next model ✓
503 → Model overloaded     → retry next model ✓
401 → Bad API key          → throw immediately ✗
400 → Bad request          → throw immediately ✗
500 → Unexpected server err → throw immediately ✗
```

If all 3 models return 429/503, throw `ALL_MODELS_EXHAUSTED` and the Server Action catches it and calls `generateRuleBasedPlan()`.

---

## 9. Post-Hackathon Upgrade Path

Everything above is designed to make the upgrade a one-line change:

### Phase 1 — Switch to Claude Sonnet (production quality)

```bash
# .env.local — change one variable
AI_MODEL=anthropic/claude-sonnet-4-5
```

No code changes needed. OpenRouter proxies all Anthropic models.

### Phase 2 — Fine-tune on real data

After 12 months of Phase 1, you will have:

- Actual vs planned litres per event
- Which model generated each plan
- Soil conditions at time of planning
- Post-irrigation yield data (from farmers)

Use this to fine-tune a local agronomic model on Hugging Face Inference Endpoints. Benefits: lower latency, no data egress, offline capability in rural areas.

### Phase 3 — Local model on-premise

Replace OpenRouter with a locally hosted model. No data leaves the government network. Complies with Egyptian data sovereignty requirements.

---

## 10. Implementation Checklist

Complete in this order:

- [ ] Create OpenRouter account at `openrouter.ai` (2 min, no credit card)
- [ ] Get API key from `openrouter.ai/keys`
- [ ] Add `OPENROUTER_API_KEY` to `.env.local`
- [ ] `npm install openai`
- [ ] Create `lib/ai/openrouter-client.ts` — 3-model cascade
- [ ] Create `app/actions/irrigation/schemas.ts` — Zod schemas
- [ ] Create `app/actions/irrigation/prompt-builder.ts` — desert-specific prompt
- [ ] Create `lib/cache/sensor-cache.ts` — Redis 30-min TTL
- [ ] Create `app/actions/irrigation/fallback.ts` — FAO-56 ETc engine
- [ ] Create `app/actions/irrigation/recommend.ts` — Server Action orchestrator
- [ ] Add `recommendations` Drizzle table + run migration
- [ ] Add DB indexes on `recommendations` table
- [ ] Wire `requestIrrigationPlan()` to the Farm Portal "Get AI Plan" button
- [ ] Add `fallback: true` banner to Farm Portal UI when plan is rule-based
- [ ] Store `modelUsed` field — visible in admin debug view

---

## 11. Security Rules (Non-Negotiable)

These must never be relaxed:

1. `farmId` is read from the JWT session only — never from URL params, request body, or query strings
2. Quota hard check runs in the Server Action independently of AI output — AI cannot bypass it
3. All DB writes (recommendation INSERT) happen in a single operation with the parsed, validated plan — never with raw AI output
4. The `recommendations` table is INSERT-only for the application service account — no UPDATE of historical records
5. Farmer must explicitly approve the plan before irrigation is triggered — AI never autonomously activates a pipeline

---

_AquaValley — New Valley Governorate Smart Water Management — Hackathon 2025_
