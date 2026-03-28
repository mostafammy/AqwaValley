/**
 * Simple OpenRouter API connection test.
 * Runs the exact example provided by OpenRouter documentation
 * to isolate whether the API key and model are functioning
 * without any domain-specific app logic.
 */
import OpenAI from "openai";
import { existsSync, readFileSync } from "fs";

// Load .env
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

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  console.error("❌ OPENROUTER_API_KEY is missing from .env");
  process.exit(1);
}

const resolvedApiKey: string = apiKey;

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: resolvedApiKey,
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000",
    "X-OpenRouter-Title": "Testing Connection",
  },
});

async function main() {
  console.log("🔄 Calling OpenRouter API...");
  console.log(`🔑 Key length: ${resolvedApiKey.length}`);

  try {
    const start = Date.now();
    const completion = await openai.chat.completions.create({
      model: "meta-llama/llama-3.3-70b-instruct:free",
      messages: [
        {
          role: "user",
          content:
            "What is the meaning of life? Please answer in one sentence.",
        },
      ],
    });
    const elapsed = Date.now() - start;

    console.log("✅ Success! API is working.\n");
    console.log(`⏱️ Response time: ${elapsed}ms`);
    console.log("🤖 Response:");
    console.log(completion.choices[0]?.message?.content);
  } catch (error: any) {
    console.error("\n❌ API Call Failed:");
    if (error?.status || error?.error) {
      console.error(`Status: ${error.status}`);
      console.error(JSON.stringify(error.error, null, 2));
    } else {
      console.dir(error, { depth: null });
    }

    // Check if it's the specific header parsing error we saw earlier
    if (error.message?.includes("ByteString")) {
      console.log("\n💡 This is a ByteString character encoding error.");
    }

    process.exit(1);
  }
}

main();
