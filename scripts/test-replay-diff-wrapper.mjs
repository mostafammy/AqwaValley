#!/usr/bin/env tsx

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local synchronously before any dynamic imports
const envLocalPath = resolve(process.cwd(), ".env.local");
try {
  const envContent = readFileSync(envLocalPath, "utf-8");
  const lines = envContent.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = trimmed.substring(0, equalsIndex).trim();
    let value = trimmed.substring(equalsIndex + 1).trim();

    // Remove surrounding quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
  console.log("✓ Environment variables loaded from .env.local");
} catch (error) {
  console.warn("⚠ Could not load .env.local file");
}

// Now dynamically import and run the test
import("./test-replay-diff.ts").catch((error) => {
  console.error("Test execution failed:", error);
  process.exit(1);
});
