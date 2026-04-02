import { UrlAssertionBuilder, UrlMonitor } from "checkly/constructs";
import type { AlertChannelRef } from "checkly/constructs";
import { resolveBaseUrl } from "./support";

/**
 * Users API URL Monitor (Synthetic Check)
 *
 * This is a simple URL monitor that checks if the users API endpoint is:
 * - Responding with HTTP 200
 * - Responding within SLA thresholds
 * - Accessible from multiple geographic locations
 *
 * F.I.R.S.T. principles:
 * - Fast: single HTTP request, minimal logic
 * - Isolated: no auth required, public health check
 * - Repeatable: runs every 5 minutes from multiple locations
 * - Self-checking: explicit status code assertion
 * - Timely: detects outages within minutes
 *
 * Configuration:
 * - Base URL resolves from AQWA_VALLEY_URL, CHECKLY_BASE_URL, or localhost
 * - Can be overridden via environment variables
 */

const BASE_URL = resolveBaseUrl();

new UrlMonitor("aqwavalley-users-api-url-monitor", {
  name: "AqwaValley — Users API URL Monitor",
  activated: true,
  maxResponseTime: 10000, // Critical alert if response > 10 seconds
  degradedResponseTime: 5000, // Warn if response > 5 seconds but < 10 seconds
  frequency: 5, // Check every 5 minutes
  request: {
    url: `${BASE_URL}/api/users`,
    followRedirects: true,
    assertions: [
      // Must return HTTP 200 OK
      UrlAssertionBuilder.statusCode().equals(200),
    ],
  },
  // Alert channels from environment (comma-separated Checkly channel IDs)
  alertChannels: process.env.CHECKLY_ALERT_CHANNELS
    ? process.env.CHECKLY_ALERT_CHANNELS.split(",")
        .map((s) => s.trim())
        .filter((s) => s !== "")
        .map((s) => ({ channelId: s }) as unknown as AlertChannelRef)
    : [],
});
