---
title: Ingest Endpoints and Cron Readiness
owner: Platform and Data Team
last_updated: 2026-03-17
audience: Backend, Frontend, DevOps, QA
status: active
---

## Purpose

This document summarizes all current ingestion-related endpoints and clarifies whether the repository currently supports Vercel Cron triggered sensor simulation.

## Current Endpoint Inventory

| Endpoint                  | Method      | Auth Model                              | Primary Use                                            | Status |
| ------------------------- | ----------- | --------------------------------------- | ------------------------------------------------------ | ------ |
| /api/sensors/ingest       | POST        | API key in X-API-Key or Bearer          | Production-style sensor ingest (single or batch)       | Active |
| /api/admin/mock-ingest    | POST        | Logged-in admin session cookie          | Manual admin-triggered mock reading ingest             | Active |
| /api/cron/simulate-ingest | GET or POST | CRON secret via Bearer or x-cron-secret | Scheduled machine-to-machine live simulation execution | Active |
| /api/wells/:id/metrics    | GET         | Logged-in session cookie                | Read aggregated well metrics                           | Active |
| /api/health               | GET         | None                                    | Service and DB health verification                     | Active |

## Endpoint Details

### POST /api/sensors/ingest

Purpose:

- Main ingestion entrypoint for sensor devices and simulator scripts.

Authentication:

- Required API key in one of:
  - X-API-Key header
  - Authorization: Bearer <key>

Request shapes:

- Single reading:

```json
{
  "sensorId": "uuid",
  "value": 12.7,
  "timestamp": "2026-03-17T10:00:00Z"
}
```

- Batch:

```json
{
  "readings": [
    {
      "sensorId": "uuid",
      "value": 12.7,
      "timestamp": "2026-03-17T10:00:00Z"
    }
  ]
}
```

Behavior:

- Validates API key.
- Applies in-memory rate limiting per API key.
- Validates payload with Zod.
- Passes readings to ingest service.
- Returns accepted and rejected counts.

Typical status codes:

- 200: At least one reading accepted.
- 401: Missing or invalid API key.
- 422: Validation failure or all readings rejected by business validation.
- 429: Rate limit exceeded.

### POST /api/admin/mock-ingest

Purpose:

- Admin-only route for manually creating one synthetic reading for a well and sensor type.

Authentication and authorization:

- Requires authenticated session.
- Requires admin role.

Request body:

```json
{
  "wellId": "uuid",
  "sensorType": "water_level",
  "value": 12.7,
  "timestamp": "2026-03-17T10:00:00Z"
}
```

Behavior:

- Finds a sensor by wellId and sensorType.
- Builds a mock ingest context.
- Reuses shared ingest service.

Typical status codes:

- 200: Reading ingested through shared pipeline.
- 401: No valid session.
- 403: Non-admin user.
- 404: No matching sensor found.
- 422: Body validation failure.

### GET or POST /api/cron/simulate-ingest

Purpose:

- Runs scheduled sensor simulation that mimics live devices and ingests through the same backend pipeline.

Authentication:

- Machine-to-machine secret validation using one of:
  - Authorization: Bearer <CRON_SECRET>
  - x-cron-secret: <CRON_SECRET>

Request body (optional for POST):

```json
{
  "wellIds": ["uuid"],
  "readingsPerSensor": 1,
  "anomalyRate": 0.05,
  "timestamp": "2026-03-17T10:00:00Z"
}
```

Behavior:

- Discovers active sensors from active wells.
- Generates deterministic values by sensor type with bounded noise and optional anomalies.
- Reuses ingest service so validation, latest state updates, and alerts are consistent with real sensor traffic.
- Returns structured summary with runId, per-well stats, totals, and duration.

Method behavior:

- GET: primary method used by Vercel Cron scheduler.
- POST: useful for manual triggers and scripted operational runs.

Typical status codes:

- 200: Cron simulation run completed (ok, partial_failure, or failure summary in payload).
- 400: Invalid body, invalid limits, or malformed JSON.
- 401: Missing or invalid cron secret.
- 500: Internal cron execution failure.

## Simulator Support Available Today

Script:

- scripts/mock-simulator.ts

How it works:

- Runs as a local or hosted process.
- Sends periodic POST calls to /api/sensors/ingest.
- Requires API key plus configured sensor IDs.

Important:

- This is process-based simulation, not a server endpoint scheduler.

## Vercel Cron Readiness Assessment

Current state:

- Dedicated cron endpoint exists at /api/cron/simulate-ingest.
- vercel.json cron schedule is configured to run every 5 minutes.
- CRON_SECRET and simulator controls are defined in env schema.

Conclusion:

- The project now has a first-class Vercel Cron simulation path ready for deployment configuration.

## Can Existing Endpoints Be Used by Vercel Cron

Short answer:

- Yes. Use /api/cron/simulate-ingest for production automation.

Why:

- /api/cron/simulate-ingest is purpose-built for machine-to-machine invocation.
- It does not depend on browser sessions.
- It handles sensor discovery and value generation server-side.
- It still reuses ingest service for parity with production device traffic.

## Recommended Production Pattern for Cron

Implemented endpoint:

- /api/cron/simulate-ingest

Security model:

- Protect with CRON_SECRET header validation.
- Do not require browser session cookies.
- Restrict to POST and server-side execution.

Execution model:

- Query configured sensors per target wells.
- Generate deterministic synthetic values.
- Reuse existing ingest service for writes.
- Return structured summary: accepted, rejected, duration, per-well stats.

Observability:

- Log run id, start and end timestamps, counts, and failures.
- Return stable error codes for DevOps alerting.

## Frontend and QA Summary

What frontend can rely on now:

- Device ingestion flow is /api/sensors/ingest.
- Admin manual simulation exists via /api/admin/mock-ingest.
- Scheduled machine simulation exists via /api/cron/simulate-ingest.
- Metrics retrieval exists via /api/wells/:id/metrics.

What is missing for scheduled simulation:

- Production Vercel environment variables must be set (CRON_SECRET and simulator limits).
- DevOps monitoring should track cron run success rate, duration, and failure codes.
