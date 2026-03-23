---
title: Quota Service Runtime Behavior
owner: Platform and Data Team
last_updated: 2026-03-23
audience: Backend, Frontend, DevOps, QA, Product
status: active
---

## Purpose

This document explains exactly how quota logic works at runtime in AqwaValley.
It answers these operational questions:

- Is quota tracking executed for each ingest request?
- When does quota state get computed and persisted?
- Is ingestion automatically blocked when quota is exceeded?

## Executive Answer

- Quota tracking is not currently enforced on every ingest request.
- Quota state is computed on demand when quota API endpoints are called.
- If quota is exceeded, the system records quota state and breach events, but ingestion is not automatically blocked.

## Scope and Terms

- Scope types: farm and district.
- Raw state: decision from consumption, quota, and thresholds.
- Effective state: raw state after applying active manual overrides.
- Breach event: persisted event for warning, critical, or exceeded states.

## Runtime Architecture

| Area              | Current behavior                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Ingestion         | Validates auth and payload, writes readings, updates latest state, evaluates alert rules |
| Quota computation | Runs when quota endpoints are called                                                     |
| Quota persistence | Upserts period snapshots and creates breach events                                       |
| Hard enforcement  | Not active in ingest path                                                                |

## What Happens During Ingest

Ingest flows through service logic that focuses on authentication, sensor ownership, data insertion, latest state upsert, and alert-rule evaluation.

Ingest path includes:

- POST /api/sensors/ingest
- POST /api/admin/mock-ingest
- Cron simulation ingest

Current ingest pipeline does not call quota decision functions directly.
Therefore, quota does not currently block reading acceptance in this path.

## When Quota Logic Runs

Quota logic runs when quota API procedures are called, including farm and district status queries.
At that time, the service:

1. Resolves period bounds.
2. Aggregates consumption for the period.
3. Resolves quota target.
4. Computes utilization and trend.
5. Derives raw state.
6. Applies active override to derive effective state.
7. Upserts snapshot row.
8. Creates breach event for warning, critical, or exceeded states if not already open for the same key.

## State Decision Rules

High-level state logic:

1. If quota is missing or zero, state is needs_review.
2. If utilization is greater than 100 percent, state is exceeded.
3. Otherwise, thresholds determine warning or critical.
4. Otherwise, state is ok.

Threshold defaults are environment-configurable:

- QUOTA_WARNING_THRESHOLD_PCT
- QUOTA_CRITICAL_THRESHOLD_PCT
- QUOTA_BASELINE_MONTH_WINDOW

## Is It Tracking Each Request

Not in the strict per-request enforcement sense.

What is true today:

- Sensor readings are persisted at ingest time.
- Quota state is derived from persisted readings when quota APIs are queried.
- Snapshot rows and breach events become the read model for quota dashboards and alerts.

This means quota tracking is near-real-time by query cadence, not by guaranteed synchronous gating at ingest write time.

## What Happens After Quota Is Exceeded

When quota API computation detects exceeded state:

- rawState becomes exceeded.
- effectiveState is resolved, possibly modified by an active override.
- A quota breach event can be created with open status.
- Quota alert APIs can show the open breach.

What does not happen automatically today:

- The next ingest request is not rejected because of quota exceeded alone.
- No hard stop is currently enforced in ingest service.

## Auto Behavior Clarification

Question: Will it work automatically when quota is exceeded?

Answer:

- Automatic state transition and event creation happen during quota computation calls.
- Automatic hard blocking of ingest does not happen in current implementation.

So there is auto monitoring and persistence on quota evaluation, but no auto write rejection in ingest path.

## Operational Implications

- Dashboards and API consumers can react to exceeded status and open breaches.
- Enforcement is policy-driven but currently manual or downstream.
- If hard enforcement is required, ingest must include quota gate checks before accepting readings.

## Recommended Next Step for Hard Enforcement

To enforce strict quota limits, add a pre-write quota gate in ingest service:

1. Resolve farm and district scope for incoming readings.
2. Compute or read current quota decision.
3. Reject ingest with explicit error when policy says block.
4. Keep policy configurable by scope and role.

This should be implemented carefully to avoid high ingest latency and race conditions under concurrency.

## One-Line Summary

Current quota service automatically computes and records quota status when quota endpoints are called, but it does not automatically block the next ingest request after quota is exceeded.
