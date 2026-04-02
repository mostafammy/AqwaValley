import { HeartbeatMonitor } from "checkly/constructs";

/**
 * Heartbeat Monitor for Scheduled Jobs
 *
 * Heartbeat monitors validate that critical background jobs are running on schedule.
 *
 * To use this monitor:
 * 1. Deploy this check with Checkly CLI: `npx checkly deploy`
 * 2. Copy the ping URL from the CLI output
 * 3. Add the ping call to your scheduled job (cron, queue handler, etc.)
 * 4. Checkly will alert if it doesn't receive a ping within the configured grace period
 *
 * F.I.R.S.T. principles:
 * - Fast: heartbeat is just an HTTP call, minimal overhead
 * - Isolated: monitors background jobs independently from the main app
 * - Repeatable: same ping URL used across all runs
 * - Self-checking: Checkly automatically alerts on missing pings
 * - Timely: runs continuously, detects failures within minutes
 *
 * Example job integration:
 *   // In your cron or queue handler
 *   const pingUrl = process.env.CHECKLY_HEARTBEAT_PING_URL;
 *   await fetch(pingUrl, { method: "GET" });
 */

new HeartbeatMonitor("aqwavalley-simulator-heartbeat", {
  name: "AqwaValley — Simulator Heartbeat",
  description:
    "Validates that the simulator cron job is running on schedule. " +
    "Alerts if no heartbeat pings are received within the grace period.",
  activated: false, // Deactivated until the ping URL is configured in the cron job
  period: 1,
  periodUnit: "hours", // Expect a ping every 1 hour
  grace: 30, // Allow up to 30 minutes of grace time before alerting
  graceUnit: "minutes",
  alertChannels: process.env.CHECKLY_ALERT_CHANNELS
    ? process.env.CHECKLY_ALERT_CHANNELS.split(",")
        .map((s) => s.trim())
        .filter((s) => s !== "")
        .map((s) => ({ channelId: s }))
    : [],
});
