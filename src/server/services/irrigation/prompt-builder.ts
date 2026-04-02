/**
 * Irrigation AI Prompt Builder — Desert-specific prompt construction.
 *
 * This is the most critical file in the AI irrigation engine.
 * Generic agricultural prompts produce dangerously wrong recommendations
 * for a desert aquifer system. All domain constants live here.
 *
 * System prompt (immutable constraints):
 * - Desert climate, near-zero rainfall
 * - ET₀ ranges calibrated for New Valley, not generic values
 * - Nubian Aquifer non-renewability + Kharga 15% conservation
 * - FAO-56 ETc formula with crop Kc reference values
 * - Irrigation efficiency factors by system type
 * - JSON-only output with exact schema
 *
 * User message (per-request):
 * - Farm name, district, area
 * - Monthly quota (total, used, remaining)
 * - Per-zone soil data with deficit calculations
 * - 3-day weather forecast
 *
 * @module server/services/irrigation/prompt-builder
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PromptFarmContext {
  readonly name: string;
  readonly districtName: string;
  readonly areaHectares: number;
}

export interface PromptZoneContext {
  readonly id: string;
  readonly name: string;
  readonly cropType: string;
  readonly growthStage: string;
  readonly areaHectares: number;
  readonly irrigationSystem: "drip" | "sprinkler" | "flood";
}

export interface PromptQuotaContext {
  readonly monthlyLimit: number;
  readonly usedLitres: number;
  readonly remainingLitres: number;
}

export interface PromptSoilReading {
  readonly humidityPct: number | null;
  readonly tempCelsius: number | null;
}

export interface PromptWeatherDay {
  readonly maxTemp: number;
  readonly et0: number;
  readonly rain: number;
}

export interface PromptContext {
  readonly farm: PromptFarmContext;
  readonly zones: readonly PromptZoneContext[];
  readonly quota: PromptQuotaContext;
  readonly soilReading: Readonly<Record<string, PromptSoilReading | null>>;
  readonly weather: {
    readonly daily: readonly PromptWeatherDay[];
  };
}

export interface BuiltPrompt {
  readonly systemPrompt: string;
  readonly userMessage: string;
}

// ---------------------------------------------------------------------------
// Domain Constants — New Valley Governorate, Egypt
// ---------------------------------------------------------------------------

/** Field capacity targets (% soil moisture) by crop type. */
const FIELD_CAPACITY_TARGETS: Readonly<Record<string, number>> = {
  wheat: 70, // 60–80% midpoint
  date_palm: 50, // 40–60% midpoint
  corn: 72, // 65–80% midpoint
  sugar_beet: 65,
  alfalfa: 75,
} as const;

const DEFAULT_FIELD_CAPACITY = 65;

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function getCropFieldCapacity(cropType: string): number {
  return FIELD_CAPACITY_TARGETS[cropType.toLowerCase()] ?? DEFAULT_FIELD_CAPACITY;
}

/**
 * Calculate approximate soil moisture deficit in mm.
 * Converts percentage deficit to mm using a simplified factor.
 */
function calcDeficitMm(
  soilReading: PromptSoilReading | null,
  cropType: string,
): number {
  const target = getCropFieldCapacity(cropType);
  if (!soilReading || soilReading.humidityPct === null) {
    // Conservative fallback: treat missing humidity as 0% so deficit = full field capacity
    return parseFloat((target * 0.1).toFixed(2));
  }
  const deficit = Math.max(0, target - soilReading.humidityPct);
  return parseFloat((deficit * 0.1).toFixed(2));
}

// ---------------------------------------------------------------------------
// System Prompt (immutable constraints — same for every plan)
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `
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

// ---------------------------------------------------------------------------
// Public API — Build prompt from context
// ---------------------------------------------------------------------------

/**
 * Build the system prompt and user message for the irrigation AI.
 *
 * @param ctx - Full farm/zone/quota/soil/weather context
 * @returns System prompt (immutable constraints) and user message (per-request data)
 */
export function buildIrrigationPrompt(ctx: PromptContext): BuiltPrompt {
  const zoneDetails = ctx.zones
    .map((zone) => {
      const soil = ctx.soilReading[zone.id] ?? null;
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

  const quotaRemainingPct = (ctx.quota.monthlyLimit > 0
    ? (ctx.quota.remainingLitres / ctx.quota.monthlyLimit) * 100
    : 0).toFixed(1);

  const userMessage = `
FARM DETAILS:
  name: ${ctx.farm.name}
  district: ${ctx.farm.districtName}
  total_area_hectares: ${ctx.farm.areaHectares}

WATER QUOTA (current month):
  monthly_limit_litres: ${ctx.quota.monthlyLimit}
  used_litres: ${ctx.quota.usedLitres}
  remaining_litres: ${ctx.quota.remainingLitres}
  pct_remaining: ${quotaRemainingPct}%

CROP ZONES:
${zoneDetails}

WEATHER FORECAST (next 3 days):
${forecastLines}

Generate today's irrigation plan. If remaining quota < total recommended, scale down
proportionally and set quotaWarning=true. Prioritise flowering and grain_fill zones.
`.trim();

  return { systemPrompt: SYSTEM_PROMPT, userMessage };
}
