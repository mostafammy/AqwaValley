/**
 * OpenRouter AI Client — Transport layer for irrigation AI recommendations.
 *
 * Design decisions:
 * - Model cascade order: most-tested first → largest-context → largest-model
 * - Only 429 (rate limit) and 503 (overloaded) trigger retry to next model
 * - Hard errors (401, 400, 500) throw immediately — no point retrying
 * - temperature: 0 — deterministic output for regulated irrigation system
 * - Always returns { text, modelUsed } for DB traceability
 *
 * @module server/ai/openrouter-client
 */

import OpenAI from "openai";
import { env } from "~/env";
import { logger } from "~/lib/logger";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Ordered model cascade for irrigation AI.
 * Priority: instruction-following quality → context window size → model size.
 */
const MODEL_CASCADE = [
  "meta-llama/llama-3.3-70b-instruct:free", // primary — best instruction following
  "google/gemma-3-27b-it:free", // fallback 1 — largest context window (131K)
  "nousresearch/hermes-3-405b:free", // fallback 2 — largest model
] as const;

/** HTTP status codes that indicate a transient failure worth retrying. */
const RETRYABLE_STATUS_CODES = new Set([429, 503]);

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------

function createOpenRouterClient(): OpenAI {
  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: env.OPENROUTER_API_KEY ?? "",
    defaultHeaders: {
      "HTTP-Referer": "https://aquavalley.gov.eg",
      "X-Title": "AquaValley — Smart Water Management",
    },
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AIResponse {
  readonly text: string;
  readonly modelUsed: string;
}

/**
 * Call the irrigation AI with automatic model cascade on transient failures.
 *
 * @param systemPrompt - Domain-specific system prompt (desert climate, FAO-56, etc.)
 * @param userMessage  - Per-request farm/zone/quota context
 * @returns Parsed text response and which model generated it
 * @throws {Error} With message `ALL_MODELS_EXHAUSTED` if every model is unavailable
 * @throws {Error} On non-retryable errors (bad auth, invalid request, etc.)
 */
export async function callIrrigationAI(
  systemPrompt: string,
  userMessage: string,
): Promise<AIResponse> {
  const client = createOpenRouterClient();

  for (const model of MODEL_CASCADE) {
    try {
      const response = await client.chat.completions.create({
        model,
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      });

      const text = response.choices[0]?.message?.content;
      if (!text) {
        throw new Error(`Empty response from model ${model}`);
      }

      logger.info({ model }, "ai.irrigation.success");
      return { text, modelUsed: model };
    } catch (err: unknown) {
      const status =
        err instanceof Object && "status" in err
          ? (err as { status: number }).status
          : undefined;

      const isRetryable = status !== undefined && RETRYABLE_STATUS_CODES.has(status);

      if (!isRetryable) {
        throw err;
      }

      logger.warn(
        { model, status },
        "ai.irrigation.model_unavailable — trying next model",
      );
    }
  }

  throw new Error("ALL_MODELS_EXHAUSTED");
}
