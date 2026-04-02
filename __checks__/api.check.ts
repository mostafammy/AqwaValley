import { ApiCheck, AssertionBuilder } from "checkly/constructs";
import type { AlertChannelRef } from "checkly/constructs";
import { resolveBaseUrl } from "./support";

/**
 * AqwaValley Users API Smoke Check
 *
 * Validates that the users API endpoint:
 * - Returns a 200 status code
 * - Responds within SLA (degraded > 10s, critical > 20s)
 * - Is accessible from the outside
 *
 * F.I.R.S.T. principles applied:
 * - Fast: single endpoint check, minimal assertions
 * - Isolated: no dependencies on specific data or auth state
 * - Repeatable: uses environment-based URL resolution
 * - Self-checking: explicit status code assertion
 * - Timely: runs on every deployment as a smoke test
 */

// Configure the base URL from environment variables in priority order:
// 1. AQWA_VALLEY_URL (user-provided override)
// 2. CHECKLY_BASE_URL (Checkly provided)
// 3. ENVIRONMENT_URL (deployment-specific)
// 4. http://localhost:3000 (default for local development)
const BASE_URL = resolveBaseUrl();

// Alert channels from environment (comma-separated Checkly channel IDs)
const ALERT_CHANNELS: AlertChannelRef[] = process.env.CHECKLY_ALERT_CHANNELS
  ? process.env.CHECKLY_ALERT_CHANNELS.split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "")
      .map((s) => ({ channelId: s }) as unknown as AlertChannelRef)
  : [];

new ApiCheck("aqwavalley-users-api-smoke", {
  name: "AqwaValley — Users API (smoke check)",
  alertChannels: ALERT_CHANNELS,
  // SLA thresholds: if response > 10s, degrade; if response > 20s, critical alert
  degradedResponseTime: 10000, // milliseconds
  maxResponseTime: 20000, // milliseconds
  request: {
    url: `${BASE_URL}/api/users`,
    method: "GET",
    followRedirects: true,
    skipSSL: false,
    // Assertions are the test steps — explicit, clear, fail-fast
    assertions: [
      // Must return HTTP 200 OK
      AssertionBuilder.statusCode().equals(200),
      // Response must include content-type header
      AssertionBuilder.headers("content-type").contains("application/json"),
    ],
  },
  // Run sequentially with other checks to avoid rate limit issues
  runParallel: false,
  frequency: 10, // Run every 10 minutes
  locations: [
    // Deploy to multiple regions for geographic coverage
    // Checkly will run this check from these locations
    // Examples: "us-east-1", "eu-west-1", "ap-southeast-1"
    // Configure actual locations in your Checkly dashboard
  ],
});
