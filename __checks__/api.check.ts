import { ApiCheck, AssertionBuilder } from "checkly/constructs";
import type { AlertChannelRef } from "checkly/constructs";

// API checks send an HTTP request to a URL endpoint and validate the response. Read more at:
// https://www.checklyhq.com/docs/api-checks/

// Configure the base URL and alert channels via environment variables so the
// same check file can be used across environments (local, staging, prod).
// Prefer `AQWA_VALLEY_URL`, then `CHECKLY_BASE_URL`, then localhost.
const BASE_URL =
  process.env.AQWA_VALLEY_URL ?? process.env.CHECKLY_BASE_URL ?? "http://localhost:3000";
// CHECKLY_ALERT_CHANNELS is a comma-separated list of Checkly alert channel IDs.
// The constructs SDK expects an array of AlertChannel/AlertChannelRef objects,
// so map the CSV into `{ channelId: string }` objects.
const ALERT_CHANNELS: AlertChannelRef[] = process.env.CHECKLY_ALERT_CHANNELS
  ? process.env.CHECKLY_ALERT_CHANNELS
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "")
      .map((s) => ({ channelId: s }) as unknown as AlertChannelRef)
  : [];

new ApiCheck("aqwavalley-users-check-1", {
  name: "AqwaValley — Users API (smoke)",
  // Set alert channel IDs via CHECKLY_ALERT_CHANNELS env var (comma-separated)
  // Provide alert channel references parsed from env.
  alertChannels: ALERT_CHANNELS,
  degradedResponseTime: 10000, // milliseconds
  maxResponseTime: 20000,
  request: {
    // Prefer users list or a health endpoint. Override with CHECKLY_BASE_URL.
    url: `${BASE_URL}/api/users`,
    method: "GET",
    followRedirects: true,
    skipSSL: false,
    assertions: [
      // Expect a successful HTTP response
      AssertionBuilder.statusCode().equals(200),
      // Verify the body is an array. If the array is non-empty, ensure the
      // first object's `id` is present. This allows an empty-but-valid array
      // to pass the smoke test.
      AssertionBuilder.jsonBody("$").isArray(),
      AssertionBuilder.jsonBody("$").satisfies((json: unknown) => {
        const arr = json as any[];
        if (!Array.isArray(arr)) return false;
        return arr.length === 0 || (arr[0] && arr[0].id != null);
      }),
    ],
  },
  runParallel: false,
});
