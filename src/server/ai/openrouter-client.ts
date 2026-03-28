/**
 * Irrigation AI Client — Multi-provider transport layer.
 *
 * Provider cascade (in order):
 *  1. Groq      — `openai/gpt-oss-120b`  (fastest inference, generous free tier)
 *  2. OpenRouter — full model waterfall   (broad fallback pool)
 *
 * Within each provider, 429 / 503 / 404 / 400 and all 5xx trigger a retry to
 * the next model. Hard errors (for example 401) throw immediately.
 *
 * temperature: 0 — deterministic output for a regulated irrigation system.
 * Always returns { text, modelUsed } for DB traceability.
 *
 * @module server/ai/openrouter-client
 */

import Groq from "groq-sdk";
import OpenAI from "openai";
import { env } from "~/env";
import { logger } from "~/lib/logger";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The single model tried via Groq.
 * Groq hosts openai/gpt-oss-120b natively — same model ID as OpenRouter.
 */
const GROQ_MODEL = "openai/gpt-oss-120b" as const;

/**
 * Ordered OpenRouter fallback cascade.
 * Priority: instruction-following quality → context window → model size.
 * `openai/gpt-oss-120b:free` heads the list so OpenRouter also tries it
 * if Groq is unavailable.
 */
const OPENROUTER_CASCADE = [
  "openai/gpt-oss-120b:free", // same model, via OpenRouter
  "meta-llama/llama-3.3-70b-instruct:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "mistralai/mistral-nemo:free",
  "google/gemini-2.0-flash-exp:free",
  "deepseek/deepseek-chat:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "minimax/minimax-m2.5:free",
] as const;

/**
 * HTTP status codes that trigger a cascade to the next model.
 * - 429  Rate limited  — free tier congested
 * - 503  Unavailable   — upstream server down
 * - 404  Not Found     — model removed or data-policy blocked
 * - 400  Bad Request   — model ID string no longer valid
 * - 5xx  Server errors  — transient provider instability
 */
const isTransientError = (status: number): boolean =>
  status === 429 ||
  status === 503 ||
  status === 404 ||
  status === 400 ||
  (status >= 500 && status < 600);

// ---------------------------------------------------------------------------
// Client factories (lazy-initialised, only when key is present)
// ---------------------------------------------------------------------------

function createGroqClient(): Groq | null {
  const key = env.GROQ_API_KEY;
  if (!key) return null;
  return new Groq({ apiKey: key });
}

function createOpenRouterClient(): OpenAI | null {
  const key = env.OPENROUTER_API_KEY;
  if (!key) return null;

  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: key,
    defaultHeaders: {
      "HTTP-Referer": "https://aquavalley.gov.eg",
      "X-OpenRouter-Title": "AquaValley - Smart Water Management",
    },
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Extract a numeric HTTP status from an unknown thrown value, if present. */
function extractStatus(err: unknown): number | undefined {
  if (err instanceof Object && "status" in err) {
    return (err as { status: number }).status;
  }
  return undefined;
}

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

/**
 * Attempt a single chat completion via the Groq client.
 * Returns the response text or throws.
 */
async function callGroq(
  client: Groq,
  model: string,
  messages: ChatMessage[],
): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    temperature: 0,
    messages,
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error(`Empty response from Groq model ${model}`);
  return text;
}

/**
 * Attempt a single chat completion via the OpenAI-compatible OpenRouter client.
 * Returns the response text or throws.
 */
async function callOpenRouter(
  client: OpenAI,
  model: string,
  messages: ChatMessage[],
): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    temperature: 0,
    messages,
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error(`Empty response from OpenRouter model ${model}`);
  return text;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AIResponse {
  readonly text: string;
  readonly modelUsed: string;
}

/**
 * Call the irrigation AI with automatic provider + model cascade on
 * transient failures.
 *
 * Cascade order:
 *  1. Groq   → openai/gpt-oss-120b   (skipped silently if GROQ_API_KEY unset)
 *  2. OpenRouter → openai/gpt-oss-120b:free → full fallback waterfall
 *
 * @param systemPrompt - Domain-specific immutable constraints (FAO-56, desert climate, etc.)
 * @param userMessage  - Per-request farm/zone/quota context
 * @returns Parsed text response and which model generated it
 * @throws {Error} `ALL_MODELS_EXHAUSTED` if every provider + model is unavailable
 * @throws {Error} On non-retryable errors (bad auth, invalid request body, etc.)
 */
export async function callIrrigationAI(
  systemPrompt: string,
  userMessage: string,
): Promise<AIResponse> {
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  // ── Tier 1: Groq ─────────────────────────────────────────────────────────
  const groqClient = createGroqClient();

  if (groqClient) {
    try {
      const text = await callGroq(groqClient, GROQ_MODEL, messages);
      logger.info(
        { model: GROQ_MODEL, provider: "groq" },
        "ai.irrigation.success",
      );
      return { text, modelUsed: `groq:${GROQ_MODEL}` };
    } catch (err: unknown) {
      const status = extractStatus(err);
      const isRetryable = status !== undefined && isTransientError(status);

      if (!isRetryable) {
        // Hard failure on Groq — do NOT propagate; fall through to OpenRouter
        logger.warn(
          { model: GROQ_MODEL, status, provider: "groq" },
          "ai.irrigation.groq_hard_error — falling through to OpenRouter",
        );
      } else {
        logger.warn(
          { model: GROQ_MODEL, status, provider: "groq" },
          "ai.irrigation.groq_unavailable — falling through to OpenRouter",
        );
      }
    }
  } else {
    logger.info(
      { provider: "groq" },
      "ai.irrigation.groq_skipped — GROQ_API_KEY not configured",
    );
  }

  // ── Tier 2: OpenRouter cascade ───────────────────────────────────────────
  const openRouterClient = createOpenRouterClient();

  if (openRouterClient) {
    for (const model of OPENROUTER_CASCADE) {
      try {
        const text = await callOpenRouter(openRouterClient, model, messages);
        logger.info({ model, provider: "openrouter" }, "ai.irrigation.success");
        return { text, modelUsed: model };
      } catch (err: unknown) {
        const status = extractStatus(err);
        const isRetryable = status !== undefined && isTransientError(status);

        if (!isRetryable) {
          throw err; // Hard error — bail out immediately
        }

        logger.warn(
          { model, status, provider: "openrouter" },
          "ai.irrigation.model_unavailable — trying next model",
        );
      }
    }
  } else {
    logger.warn(
      { provider: "openrouter" },
      "ai.irrigation.openrouter_skipped — OPENROUTER_API_KEY not configured",
    );
  }

  // ── All providers exhausted ───────────────────────────────────────────────
  throw new Error("ALL_MODELS_EXHAUSTED");
}
