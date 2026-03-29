# Irrigation API Frontend Integration Guide

## Purpose
This guide explains how frontend applications should use irrigation endpoints, what happens in the backend for each call, and which signals should be tracked for reliable UX and debugging.

Scope:
- Trigger irrigation execution from a recommendation
- Observe execution status
- Replay a simulation run for determinism checks
- Diff two simulation runs for regression quality checks

Primary router implementation:
- src/server/api/routers/irrigation.ts

## Endpoint Summary

### 1. activateRecommendation (mutation)
Use this when the farmer confirms a recommendation and wants execution to begin.

Input fields:
- farmId: UUID
- recommendationId: UUID
- wellIds: UUID[] minimum 1
- durationMinutes: integer 1 to 1440
- planSource: optional string
- modelMode: optional, production or demo

Output fields:
- irrigationEventId
- simulationRunId
- status
- queueJobId

Backend flow:
1. Auth check and farm authorization
2. Event and simulation run records are created
3. Queue job is scheduled
4. Initial valve audit entries are persisted
5. Response is returned immediately for async monitoring

Frontend use:
- Show confirmation with irrigationEventId
- Navigate user to live monitoring view
- Start status polling using irrigationEventId

### 2. getIrrigationStatus (query)
Use this as the source of truth for monitoring the lifecycle of an irrigation event.

Input fields:
- farmId: UUID
- irrigationEventId: UUID

Output includes:
- event status and timestamps
- debit status and attempts
- failure code and message when applicable
- latest simulationRun summary

Backend flow:
1. Auth check and farm authorization
2. Reads event + latest run data
3. Returns normalized status snapshot

Frontend use:
- Poll after activation
- Drive status badges, progress, and action availability
- Stop polling when terminal state is reached

Recommended polling policy:
- QUEUED or RUNNING: every 2 to 5 seconds
- DEBIT_PENDING: every 10 to 30 seconds
- COMPLETED, FAILED, CANCELLED: stop polling

### 3. replaySimulationRun (mutation)
Use this for deterministic replay verification of one run.

Input fields:
- runId: UUID

Output fields:
- runId
- replayStatus: MATCH or NONDETERMINISTIC
- expectedOutputHash
- replayOutputHash

Backend flow:
1. Auth check through run to farm ownership chain
2. Reads stored input envelope and provider snapshot
3. Re-executes simulation with same runtime inputs
4. Recomputes output hash
5. Compares against stored trajectory hash
6. Persists replay result fields on irrigation_simulation_run

Frontend use:
- Expose as a diagnostics action on a run details panel
- Show deterministic verdict with hash comparison
- Highlight NONDETERMINISTIC as high-severity alert

### 4. diffSimulationRuns (mutation)
Use this for baseline versus candidate run quality checks.

Input fields:
- baseRunId: UUID
- candidateRunId: UUID

Output fields:
- status: PASS, WARN, FAIL
- waterLevelRmse
- flowRmse
- totalExtractedDeltaPercent
- invalidQualityStateIncrease
- violatedThresholds

Backend flow:
1. Auth check for both runs
2. Farm consistency validation for both run IDs
3. Loads water_level and flow_rate series from simulation telemetry
4. Computes RMSE and extracted volume delta
5. Compares invalid quality state counts
6. Classifies PASS, WARN, or FAIL using threshold policy
7. Persists diff fields on candidate run record

Frontend use:
- Expose as compare action between two runs
- Show metric table and threshold badges
- Escalate FAIL to release/ops workflow

## What Frontend Should Track

Track these for best operational value:

### A. Correlation and identity
- irrigationEventId
- simulationRunId
- queueJobId
- farmId
- recommendationId

Why:
Needed to correlate UI state with logs, support tickets, and backend records.

### B. Lifecycle timing
- activation time
- first QUEUED seen time
- first RUNNING seen time
- terminal time
- computed queue wait and execution duration in UI telemetry

Why:
Helps diagnose queue pressure and runtime regressions.

### C. Determinism and regression diagnostics
- replayStatus
- expectedOutputHash
- replayOutputHash
- diff status and metric payload
- violatedThresholds

Why:
Needed to detect model drift, nondeterminism, and regression risk before broader rollout.

### D. User-visible reliability states
- event status
- quota debit status and attempts
- failure code and failure message

Why:
Allows accurate, actionable user messaging instead of generic errors.

## Suggested UI Behavior by State

### Event states
- REQUESTED or QUEUED: show queued badge and estimated wait message
- RUNNING: show live badge and disable re-activation
- DEBIT_PENDING: show warning banner and retry note
- COMPLETED: show success summary with run metrics
- FAILED: show error panel with retry guidance
- CANCELLED: show cancelled info and final timestamp

### Replay states
- MATCH: green deterministic badge
- NONDETERMINISTIC: red alert badge + copyable hash pair
- ERROR path from backend: show retry action and diagnostics hint

### Diff states
- PASS: green badge
- WARN: amber badge with details panel
- FAIL: red badge with violated thresholds list and escalation CTA

## Error Contract to Handle in Frontend

Common tRPC error codes for these endpoints:
- FORBIDDEN: user has no farm access
- NOT_FOUND: farm, run, or irrigation event not found
- BAD_REQUEST: invalid run pair, invalid replay input, or domain validation failure

Recommended UX:
- FORBIDDEN: access denied state
- NOT_FOUND: missing resource state with navigation back
- BAD_REQUEST: inline guidance with retry or corrected input

## Frontend Integration Pattern (tRPC React)

Recommended mutation and query strategy:
1. Trigger activateRecommendation mutation
2. Store irrigationEventId and simulationRunId in component state
3. Start getIrrigationStatus polling using irrigationEventId
4. On terminal event state, stop polling
5. Optionally trigger replaySimulationRun for diagnostics
6. Optionally trigger diffSimulationRuns for baseline comparison

Use optimistic UI only for non-critical visual feedback. Keep status truth from getIrrigationStatus responses.

## Production Checklist for Frontend Teams

- Access checks and forbidden UI state implemented
- Polling starts and stops with lifecycle-aware cadence
- Terminal states are handled explicitly
- Replay results are visible and copyable
- Diff metrics and threshold violations are visible
- Error code to UX mapping is implemented
- Correlation IDs are logged in client telemetry
- Support panel can display irrigationEventId and simulationRunId

## Reference Files
- src/server/api/routers/irrigation.ts
- src/server/services/irrigation/triggerService.ts
- src/server/services/irrigation/runReplayService.ts
- src/server/services/irrigation/runDiffService.ts
- src/trpc/react.tsx
