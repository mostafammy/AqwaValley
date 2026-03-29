# Irrigation Trigger Simulation - Production Implementation Plan

## Document Control

- Project: AqwaValley
- Scope: Farm-triggered irrigation simulation with production-grade reliability, observability, and deterministic replay
- Date: 2026-03-29
- Status: Review Draft (Pre-Implementation)
- Audience: Backend Engineering, Platform/SRE, Data Engineering, Product, QA

---

## 1. Objectives and Non-Objectives

### Objectives

- Build a realistic farm irrigation trigger workflow:
  1. Request irrigation plan
  2. Review recommendation
  3. Activate irrigation
  4. Monitor live execution and quota impact
- Provide physically credible sensor simulation with explicit numerical contracts.
- Support high concurrency through asynchronous execution.
- Guarantee deterministic replay and run-diff regression analysis.
- Provide production observability and explicit failure semantics.
- Enforce maintainable architecture using SOLID principles and interface boundaries.

### Non-Objectives (V1)

- Real hardware valve control.
- Full CFD/hydrodynamic aquifer simulation.
- High-fidelity atmospheric microclimate model beyond validated irrigation-nearfield approximation.

---

## 2. Product and Runtime Flow

1. Farmer requests irrigation recommendation.
2. System generates/loads recommendation and validates quota constraints.
3. Farmer activates irrigation (plan-derived duration with optional farmer override).
4. API validates authorization and enqueues a simulation job.
5. Queue worker runs physics engine and emits simulated readings to simulation_stream for shadow_ingest processing.
6. Pipeline updates latest state, evaluates alert rules, and persists irrigation run metadata.
7. Dashboard polls live state and shows progress, ETA, and quota delta.
8. On completion, quota snapshots are debited and event is finalized.
9. If debit cannot be applied immediately, event transitions to DEBIT_PENDING and compensating retries execute until resolved.
10. If DEBIT_PENDING persists, activation follows the quota resilience policy
    (soft-limit grace, capped exposure, and audited manual override), not
    immediate hard-stop by default.

Data-path isolation policy:

1. Real telemetry follows: `real_ingest -> primary_storage`.
2. Simulated telemetry follows: `simulation_stream -> shadow_ingest -> tagged_storage`.
3. Simulation data must never enter real-time operational paths unless an explicit
   simulation-inclusive query mode is requested.

---

## 3. Architecture (SOLID-Oriented)

### Layers

- Delivery layer:
  - tRPC procedures for trigger, status, cancel, history, and valve-state history.
- Application layer:
  - TriggerService orchestrates request lifecycle and queue interaction.
  - SimulatorService coordinates provider lookups, engine execution, and ingest handoff.
- Domain layer:
  - PhysicsEngine executes ODE + sensor synthesis with strict SI units.
  - SensorFusionValidator emits quality states and divergence codes.
- Infrastructure layer:
  - BullMQ worker + Redis
  - PostgreSQL/TimescaleDB
  - Provider adapters (weather, crop coefficients, soil hydraulics)
  - Structured logging and metrics emission

### Core Interfaces (Dependency Inversion)

- ICropCoefficientProvider
- ISoilHydraulicsProvider
- IWeatherProvider
- IHydrologyModel
- IIrrigationPhysicsEngine
- IRunReplayService
- IRunDiffService

Missing mapping behavior is explicit and typed (no silent fallback by default).

---

## 4. Data Model and Persistence Plan

## 4.1 New Tables

### irrigation_event

- Purpose: lifecycle of farmer-triggered irrigation execution
- Key fields:
  - id
  - farm_id
  - well_ids
  - status (REQUESTED, QUEUED, RUNNING, COMPLETED, DEBIT_PENDING, FAILED, CANCELLED)
  - plan_source
  - duration_minutes
  - started_at, ended_at
  - actual_consumption_m3
  - quota_debit_m3
  - quota_debit_status (PENDING, APPLIED, FAILED)
  - quota_debit_attempts
  - quota_debit_last_error
  - failure_code, failure_message
  - created_at, updated_at

### well_valve_state

- Purpose: immutable audit trail of valve transitions
- Key fields:
  - id
  - well_id
  - state (CLOSED, OPENING, OPEN, CLOSING)
  - irrigation_event_id
  - reason
  - transitioned_at

### irrigation_simulation_run

- Purpose: run metadata, diagnostics, replay envelope, and output hashes
- Key fields:
  - id
  - irrigation_event_id
  - queue_job_id
  - run_status
  - engine_version
  - hydrology_model_version
  - model_mode (production, demo)
  - rng_seed
  - input_hash
  - provider_snapshot_hash
  - adapter_unit_version
  - start_timestamp
  - timezone
  - integration_step_count
  - phase_step_counts_json
  - retry_count
  - dt_min_observed_s
  - dt_max_observed_s
  - error_norm_max
  - error_norm_p95
  - numerical_divergence_count
  - mass_debt_peak_m3
  - debt_event_count
  - quality_state_counts_json
  - anomaly_code_counts_json
  - trajectory_hash
  - summary_hash
  - created_at, completed_at

### Shadow telemetry storage and tagging (mandatory)

- Purpose: prevent contamination between simulated and real telemetry while
  preserving replay/debug visibility.
- Contract:
  - Every telemetry row (real or simulated) must carry `source` tag:
    - REAL
    - SIMULATION
  - Simulation rows must also carry lineage fields:
    - simulation_run_id
    - irrigation_event_id
    - generated_at
    - generator_version
- Storage strategy:
  1. Preferred: separate physical table/hypertable for simulation telemetry
     (for example `sensor_data_simulation`) and optional view-union layer.
  2. Allowed fallback: shared table with strict `source` partitioning and
     mandatory source index.

Minimum index contract:

- `(source, sensor_id, timestamp)`
- `(simulation_run_id, timestamp)` for simulation storage

### sensor_override_schedule (optional V1.1)

- Purpose: schedule and isolate synthetic overrides if we later decouple direct ingest path.

---

## 5. Physics Engine Specification

## 5.1 Canonical Unit Contract (Mandatory)

All physics calculations use SI units only:

- length: m
- area: m^2
- volume: m^3
- flow: m^3/s
- time: s
- pressure: Pa (convert to bar only at API/UI boundary)

Conversions are allowed only in adapter layer:

- m/day to m/s by dividing by 86400
- m^3/hr to m^3/s by dividing by 3600
- mm/day to m/s by dividing by 1000 then by 86400

No mixed-unit math inside ODE/integrator functions.

## 5.2 State and ODE

State vector:

- h_m: water level depth proxy
- water_debt_m3: mass conservation debt when dry-well boundary is hit

Core equation:

$$\frac{dh}{dt} = \frac{Q_{in} - ET_c - D}{A}$$

where:

- Q_in in m^3/s
- ET_c in m^3/s
- D in m^3/s
- A in m^2

## 5.2.1 Hydrology Term Ownership and Model Versioning (Mandatory)

The ODE integrator is not the scientific model by itself. Scientific ownership of
`Q_in`, `ET_c`, and `D` must be encapsulated in a dedicated domain contract.

Required interface:

```ts
interface HydrologyModel {
  computeETc(input: ETcInput): number; // m^3/s
  computeDrainage(input: DrainageInput): number; // m^3/s
  computeInflow(input: InflowInput): number; // m^3/s
}
```

Ownership rules:

1. ET_c ownership
1. ET_c is time-varying and must be recomputed per integration step.
1. Kc is dynamic over time (crop stage progression), not globally static.
1. Minimum acceptable behavior is piecewise-linear Kc interpolation across
   growth-stage boundaries.

1. D ownership
1. D is deep percolation/drainage and must be derived from soil-water state and
   soil hydraulics parameters.
1. D must be non-negative and conservation-safe (cannot remove more water than
   available in the current step).

1. Q_in ownership
1. Q_in defaults to pressure/head-aware inflow behavior.
1. Constant-flow inflow is allowed only when explicitly configured and recorded
   in run provenance.

Versioning rules:

1. Hydrology model is versioned independently from engine version.
1. Required metadata field: `hydrology_model_version` (example:
   `hydrology_v1.2`).
1. Any equation/coefficient/policy change in ET_c, D, or Q_in requires a
   hydrology model version bump.
1. Replay equivalence requires both `engine_version` and
   `hydrology_model_version` to match unless run is explicitly marked as a
   cross-model comparison.

## 5.3 Adaptive Integration Error Policy

Default tolerances are pinned for production correctness:

- absTol = 1e-4 m
- relTol = 1e-5
- dtMin = 0.5 s
- dtMax = 60 s

Tolerance change policy:

- any change to absTol/relTol requires model-version bump, baseline re-run, and run-diff gate approval.

Per step:

1. Compute full step with dt.
2. Compute two half-steps with dt/2.
3. Estimate local error norm:

$$err = ||h_{full} - h_{half}||$$

4. Accept if:

$$err \le absTol + relTol \cdot max(|h_{full}|, |h_{half}|)$$

5. If reject, halve dt and retry same step.
6. If retries exceed MAX_REFINEMENTS_PER_STEP (8) or dt < dtMin:

- emit failure code NUMERICAL_DIVERGENCE
- mark run failed (non-retryable)

## 5.4 Mass Conservation at Dry Boundary

Do not destructively clamp and discard deficit.

- If tentative h < 0, set h = 0 and convert deficit depth to deficit volume.
- Accumulate deficit into water_debt_m3.
- Future inflow first repays water_debt_m3 before increasing h.
- If debt persists beyond dry-duration threshold, emit AQUIFER_DEPLETION and fail run.

Dry-duration threshold contract:

- default `max_dry_duration_seconds = 14400` (4 hours)
- config path: `simulation.depletion.maxDryDurationSeconds`
- optional overrides:
  1. well-level override (highest precedence)
  2. district-level override
  3. global default
- ownership:
  - global/district values are platform-managed configuration
  - well-level override requires operator approval and audit log

## 5.5 Sensor Synthesis and Fusion Quality

Outputs include quality metadata per timestamp:

- quality_state: VALID, DEGRADED, INVALID
- confidence in [0,1]
- anomaly_codes list

Residual checks enforce sensor consistency (flow, pressure, water-level derivative coherence).

- Threshold breach for N consecutive samples -> DEGRADED
- Persistent breach beyond M samples -> INVALID + sensor_fusion_divergence alert

---

## 6. Humidity Model Policy

Production mode must not use direct inverse-temperature RH heuristic.

Use vapor-pressure formulation:

$$RH = 100 \cdot \frac{e_a}{e_s(T)}$$

with:

- e_a from mixing ratio or dew-point state variable
- e_s(T) from saturation vapor pressure function

Ambient exchange term is included to account for changing air masses near irrigation.

Demo-only mode may use legacy simplified RH heuristic behind explicit feature flag.

---

## 7. External Dependency Boundaries and Fallbacks

### Weather ET0 provider contract

Provider freshness states:

- FRESH
- STALE
- UNAVAILABLE

Fallback order:

1. Live weather API
2. Cache (TTL-bound)
3. District climatology baseline

Every run stores ET0 provenance and age. Confidence is downgraded when stale/unavailable inputs are used.

### Missing mapping policy

For missing crop-stage Kc or missing soil Ks:

- default: fail-fast typed error MISSING_MAPPING
- optional fallback policy requires explicit enablement and emits DEGRADED output state and provenance flag

---

## 8. Async Queue and Execution Semantics

### Queue model

- BullMQ with Redis
- concurrency and backoff configured for high-throughput farm trigger traffic

### Ingestion path separation (mandatory)

- Worker output from simulation jobs must be written to `simulation_stream`
  messages/events.
- `shadow_ingest` consumes simulation_stream and writes only to tagged
  simulation storage.
- `real_ingest` consumes real devices/API keys and writes only to REAL storage.
- Cross-path writes are forbidden by contract and must raise
  `INGEST_PATH_VIOLATION`.

### Retryability classification

- Non-retryable:
  - NUMERICAL_DIVERGENCE
  - INVALID_INPUT
  - MISSING_MAPPING (unless fallback mode enabled)
- Retryable:
  - DEPENDENCY_TIMEOUT
  - DEPENDENCY_UNAVAILABLE (bounded retries)

### Lifecycle events

- simulation_queued
- simulation_started
- simulation_integrator_retry
- simulation_quality_degraded
- simulation_completed
- simulation_failed
- simulation_cancel_requested
- simulation_cancelled
- simulation_debit_pending

Each event includes run_id, irrigation_event_id, and correlation_id.

### Cancellation semantics (required)

- QUEUED run:
  - cancel is immediate; job removed from queue; status -> CANCELLED; no quota debit.
- RUNNING run:
  - cancel sets `cancel_requested=true`.
  - worker stops cooperatively at next integration step boundary (never mid-step mutation).
  - partial trajectory is persisted with terminal marker `cancelled=true`.
  - actual_consumption_m3 is finalized from generated trajectory up to stop boundary.
  - quota debit is attempted for actual partial consumption.
  - final status:
    - CANCELLED if debit succeeds
    - DEBIT_PENDING if debit fails (with retry workflow)

---

## 9. Observability, Replay, and Regression Diff

## 9.1 Structured Diagnostics (Required)

Per run metrics:

- integration_step_count
- phase_step_counts
- retry_count
- queue_wait_time_ms
- execution_time_ms
- dt_min_observed_s, dt_max_observed_s
- error_norm_max, error_norm_p95
- numerical_divergence_count
- mass_debt_peak_m3, debt_event_count
- quality_state_counts, anomaly_code_counts
- run_cost_usd
- run_cost_breakdown_json

Latency and queue observability requirements:

- SRE dashboards must expose histogram views for:
  1. queue_wait_time_ms (p50, p90, p95, p99)
  2. execution_time_ms (p50, p90, p95, p99)
- Histograms must be filterable by:
  - farm_id
  - district_id
  - model_mode
  - hydrology_model_version

Cost observability requirements:

- Every run must publish normalized cost fields:
  - run_cost_usd (total)
  - cost_compute_usd
  - cost_storage_usd
  - cost_queue_usd
  - cost_external_api_usd
- Cost fields must be replay-stable for a frozen pricing snapshot version.
- Pricing snapshot version must be persisted in run metadata:
  - pricing_snapshot_version

## 9.2 Deterministic Replay Contract

Replay envelope fields:

- engine_version
- hydrology_model_version
- model_mode
- rng_seed
- input_hash
- provider_snapshot_hash
- adapter_unit_version
- start_timestamp
- timezone

provider_snapshot_hash preimage contract (canonical JSON):

- weather provider payload:
  - et0_value_si
  - source (live_api, cache, climatology)
  - freshness (FRESH, STALE, UNAVAILABLE)
  - age_minutes
  - provider_timestamp
  - provider_version
- crop provider payload:
  - crop_type
  - growth_stage
  - kc_value
  - provider_version
- soil provider payload:
  - soil_type
  - ks_value_si
  - provider_version

Hashing requirements:

- include value + provenance + timestamps + provider version
- stable key ordering and deterministic float formatting
- two snapshots with equal numeric ET0 but different freshness/source must produce different hashes

Replay with identical envelope must reproduce byte-stable canonical output.
If output hash differs, emit REPLAY_NONDETERMINISM incident.

## 9.3 Run Diff Contract

Diff API compares base run vs candidate run:

- water-level RMSE
- flow RMSE
- total extracted volume delta
- quality-state transition delta
- anomaly-code delta
- status gate: PASS, WARN, FAIL

Accepted default thresholds (pilot-overridable by config):

- PASS:
  - water-level RMSE <= 0.02 m
  - total extracted delta <= 0.5 percent
  - no increase in INVALID quality-state count for identical envelope
- WARN:
  - 0.02 m < water-level RMSE <= 0.05 m, or
  - 0.5 percent < total extracted delta <= 1.0 percent
- FAIL:
  - water-level RMSE > 0.05 m, or
  - total extracted delta > 1.0 percent, or
  - any increase in INVALID quality-state count for identical envelope

Config path:

- `simulation.diffGate.thresholds`

---

## 10. Exact Sampling Count Policy

No approximate claims for deterministic schedules.

Use half-open interval semantics [start, end) and explicit terminal sample policy.

For fixed-step phases:

$$N_{fixed}=\sum_{i=1}^{k} \left\lfloor\frac{D_i}{s_i}\right\rfloor$$

If one terminal sample is included once at horizon T:

$$N=N_{fixed}+1$$

Example for 2h irrigation + 8h recovery profile:

- ramp-up: 300/10 = 30
- steady: 6600/60 = 110
- ramp-down: 300/10 = 30
- recovery: 28800/300 = 96
- N_fixed = 266
- with terminal sample N = 267

Adaptive-step mode reports exact runtime count from emitted timestamps and enforces strict monotonic uniqueness.

---

## 11. API and UX Scope

### API procedures

- start_irrigation
- get_irrigation_status
- cancel_irrigation
- list_recent_irrigations
- activate_recommendation
- list_valve_history
- get_current_valve_state

Query filtering contract:

- Default query mode in all operational APIs and dashboards is `source=REAL`.
- Simulation data is visible only in explicit simulation/replay endpoints or
  when `include_simulation=true` is set by authorized roles.
- Mixed-source responses must include source breakdown in metadata.

### Farm dashboard scope

- Request and review recommendation
- Activate irrigation
- Live monitor card:
  - queue status
  - progress and ETA
  - quota impact
  - quality state and confidence
- Recent runs table with replay ID and diff status badges

---

## 12. Security, Authorization, and Data Integrity

- ABAC checks enforced for all farm and well resources.
- Queue jobs carry least-privilege context only.
- Input validation at trust boundary rejects invalid numeric states (NaN, Infinity, negative where forbidden).
- Immutable audit logs for valve state and run lifecycle.
- Idempotency keys for activation requests to prevent duplicate runs.
- Simulation-write principals must not have permission to write REAL telemetry
  paths.
- Query layer enforces source scoping with deny-by-default behavior for
  simulation visibility.

Idempotency contract:

- key schema:
  - `sha256(farm_id + plan_id + normalized_well_ids + duration_minutes + requested_by_user_id + model_mode)`
- scope:
  - unique per farm_id + key
- TTL:
  - 24 hours
- behavior:
  - duplicate request within TTL returns original irrigation_event_id and run status (no new run created)
  - idempotency records are persisted and replicated (not memory-only)

Quota debit failure contract:

- debit is attempted in finalize phase after simulation stop/completion using `actual_consumption_m3`.
- outcomes:
  1. debit success -> `quota_debit_status=APPLIED`, final status COMPLETED or CANCELLED
  2. debit failure -> `quota_debit_status=FAILED`, final status DEBIT_PENDING, enqueue compensating retry job
- retry policy:
  - exponential backoff, max 12 attempts over 24 hours
- quota resilience policy (product-safe + finance-safe):
  - **Soft-limit grace window**:
    - activation remains allowed for up to `graceWindowHours` after first
      DEBIT_PENDING event for a farm.
    - default `graceWindowHours = 12`.
    - config path: `quota.debitPending.graceWindowHours`.
  - **Grace quota cap**:
    - while in grace, additional irrigation is capped by
      `maxGraceQuotaM3 = min(0.1 * monthlyQuotaM3, 100 m3)`.
    - config path: `quota.debitPending.maxGraceQuotaM3`.
  - **Escalation to hard block**:
    - hard block applies only if either:
      1. grace window expired, or
      2. grace quota exhausted.
    - hard-block reason code: `DEBIT_PENDING_LIMIT_REACHED`.
  - **Manual override with audit**:
    - authorized roles: admin or district_manager only.
    - override requires reason text and optional ticket/reference id.
    - override creates immutable audit record:
      - `override_by_user_id`, `override_reason`, `override_scope`,
        `override_expires_at`, `correlation_id`.
    - default override TTL: 24h (`quota.debitPending.overrideTtlHours`).
  - **Safety floor for rural continuity**:
    - if farm has active irrigation-critical flag and network/provider outage is
      classified as transient, one emergency activation is allowed within grace
      cap and is force-audited.
- audit:
  - every debit attempt is logged with attempt number, error code, and correlation_id

Operational note:

- DEBIT_PENDING must still surface as warning status in APIs/UI during grace;
  this is not a silent bypass.

---

## 13. Testing Strategy (Merge Gate)

### 13.1 Unit tests

- Integrator acceptance/rejection behavior
- dt halving and retry policy
- dt underflow and divergence failure
- SI conversion invariants
- mass conservation with water debt
- humidity vapor-pressure path

### 13.2 Property-based tests

- monotonic timestamp ordering
- no NaN/Infinity outputs
- conservation consistency across random valid inputs

### 13.3 Integration tests

- queue lifecycle transitions
- provider fallback behavior and confidence downgrade
- ingest path writes and alert evaluations
- cancellation and failure classification
- path isolation tests: simulation writes cannot appear in REAL query results
  by default
- source filter tests: `include_simulation=false` returns only REAL, authorized
  `include_simulation=true` returns tagged mixed data
- ingest violation tests: forced cross-path write triggers
  `INGEST_PATH_VIOLATION`

### 13.4 Stress tests

- 30-day continuous simulation run
- 1000-event replay batch
- concurrent queue workers under realistic load

### 13.5 Replay and diff tests

- deterministic replay byte stability
- run diff status gates against baseline
- non-determinism incident generation on mismatch
- telemetry validation for queue_wait_time_ms and execution_time_ms
- cost accounting validation (run_cost_usd equals sum of cost breakdown)

---

## 14. Rollout Plan

### Phase A: Hidden launch

- Enable for internal farms only
- Observe diagnostics, replay stability, and queue health

### Phase B: Controlled pilot

- 5 to 10 percent of farms
- compare simulated outcomes and anomaly rates

### Phase C: General availability

- broaden traffic progressively
- enforce run diff gates on every model/config release

Rollback path:

- disable activation endpoint feature flag
- keep historical monitoring and replay tools active

---

## 15. Operational Runbook Triggers

- Alert: numerical_divergence_rate above threshold
- Alert: replay_nondeterminism detected
- Alert: invalid_quality_state_rate drift above baseline
- Alert: run_diff_fail on release candidate
- Alert: queue_wait_time_ms p95 exceeds configured SLO
- Alert: execution_time_ms p95 exceeds configured SLO
- Alert: run_cost_usd anomaly above baseline band

Immediate actions:

1. Freeze rollout
2. Pin previous engine_version
3. Replay failing runs with frozen envelope
4. Diff against known-good baseline
5. Open incident with diagnostics bundle

---

## 16. Acceptance Criteria (Go/No-Go)

Go if all conditions pass:

- All merge-gate tests pass.
- Replay byte stability pass rate is 100 percent on fixture set.
- No unresolved numerical divergence incidents in pilot window.
- Run-diff gate is PASS for release candidate against approved baseline.
- Observability dashboards show full diagnostics population for all pilot runs.

No-Go if any of the following:

- Any silent fallback path remains in production mode.
- Any unit boundary allows mixed non-SI values into ODE core.
- Any run cannot be replayed due to missing envelope metadata.
- Any non-deterministic replay mismatch without resolved root cause.
- Any replay or diff gate is executed without `hydrology_model_version`
  compatibility (unless explicitly flagged as cross-model comparison).
- Any simulation telemetry appears in default REAL operational dashboards/APIs.
- Any ingestion path permits cross-write between simulation and real pipelines.
- Quota resilience policy (grace window, grace cap, override audit) is missing or
  not enforced in activation checks.

---

## 17. Open Decisions for Review

1. Exact pilot cohort size and duration.
2. Whether sensor_override_schedule is in V1 or deferred to V1.1.
3. Whether fallback for missing Kc/Ks is enabled in pilot (recommended: disabled).

---

## 18. Proposed Implementation Sequence

1. Schema migrations and run metadata fields
2. Provider interfaces and SI adapter boundary
3. Physics engine with adaptive retry + conservation debt
4. Sensor fusion quality layer
5. Queue worker integration and retry classification
6. Replay service and canonical hashing
7. Run-diff service and gate evaluation
8. API integration and dashboard wiring
9. Test matrix and stress suite
10. Hidden launch and pilot rollout

---

## 19. Deliverables Checklist

- Migration scripts
- Physics engine package
- Provider adapters and fallback policy
- Queue worker + events
- Replay API and diff API
- Monitoring dashboard and alerts
- Test suites and fixtures
- Rollout feature flags
- On-call runbook

---

This document is the single pre-implementation review artifact for irrigation trigger simulation productionization.
