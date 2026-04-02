# Testing Implementation Roadmap

This document maps the Strategy (docs/testing-strategy-world-class-plan.md) into executable test tasks organized by Tier and Layer.

## Execution Priorities

### Phase 1: Tier 0 Foundations (Release Blocking)

These tests must pass before any release. Implement these first.

- [ ] **Auth & Session Tests**
  - `auth_rejects_expired_session` — Test JWT expiry enforcement
  - `auth_rejects_manipulated_district_or_farm_id` — Scope correctness
  - `auth_rejects_stolen_or_expired_session` — Session invalidation

- [ ] **Ingest Authorization & Boundaries**
  - `ingest_rejects_cross_well_api_key_use` — Sensor-scoped authorization
  - `ingest_accepts_batch_49_50_51_without_off_by_one` — Batch boundary safety
  - `ingest_rejects_duplicate_sensorId_timestamp` — Idempotency
  - `ingest_enforces_rate_limit` — DoS prevention

- [ ] **Quota Enforcement**
  - `quota_rejects_irrigation_exceeding_balance` — Hard block at 100%
  - `quota_accepts_within_balance` — Normal operation
  - `quota_boundary_at_exactly_100_percent` — Edge case parity

- [ ] **Audit Log Immutability**
  - `audit_rejects_update_operations` — INSERT-only enforcement
  - `audit_rejects_delete_operations` — No deletion allowed
  - `sensitive_mutation_requires_audit_record` — Completeness

- [ ] **Role & Scope Authorization**
  - `farmer_cannot_read_other_farms` — Farm isolation
  - `district_admin_cannot_cross_access` — Scope enforcement
  - `role_reduction_invalidates_session` — Privilege change handling

### Phase 2: AI & Forecast (High Risk)

AI and forecast outputs drive production decisions and need explicit behavior contracts.

- [ ] **AI Cascade & Fallback**
  - `ai_cascade_uses_llama_then_gemma_then_hermes` — Model priority order
  - `ai_falls_back_on_retryable_errors` — Retry logic for 429/503
  - `ai_rejects_non_retryable_errors` — Fail-fast on invalid credentials
  - `ai_temperature_zero_deterministic` — Reproducibility

- [ ] **AI Output Validation**
  - `ai_schema_rejects_malformed_json` — Contract enforcement
  - `ai_rejects_exceeding_quota` — Quota-aware recommendations
  - `ai_persists_model_used_and_traceability` — Audit trail

- [ ] **Forecast Plausibility**
  - `forecast_respects_2_year_window` — vs Kharga reference
  - `forecast_rejects_physically_impossible` — Trajectory validation

### Phase 3: TimescaleDB & Data Integrity

Critical for correctness of analytics and alerting.

- [ ] **TimescaleDB Aggregation**
  - `timescaledb_bucket_groups_boundary_rows` — No off-by-one
  - `timescaledb_chunk_boundary_no_double_count` — Compression safety
  - `timescaledb_continuous_agg_staleness_window` — Freshness guarantees

- [ ] **Ingest Pipeline Integration**
  - `ingest_persists_to_timescaledb_correctly` — End-to-end write
  - `ingest_alert_trigger_respects_baseline` — Anomaly detection
  - `ingest_warning_auto_escalates_2h` — Alert lifecycle

### Phase 4: Cron & Operational Safety

Scheduled jobs must be idempotent and observable.

- [x] **Cron Idempotency**
  - `cron_simulation_isolated_by_runId` — No cross-contamination
  - `cron_same_runId_prevents_double_ingest` — Idempotency
  - `simulator_heartbeat_failure_distinct_from_cron_failure` — Observability

- [x] **Demo Mode Isolation**
  - `demo_mode_reads_dont_write_production` — Fixture safety
  - `demo_fixtures_dont_pollute_integration_db` — Cleanup

### Phase 5: Reporting & User Workflows

Reproducibility and access control for exports.

- [x] **Report Generation**
  - `report_parameter_validation` — Reject invalid inputs
  - `report_deterministic_exports` — Same SHA-256 hash for same inputs
  - `report_download_link_expiry` — Time-limited access

- [x] **Email & Notification Workflows**
  - `notification_respects_user_preferences` — Opt-out handling
  - `email_template_renders_correctly` — No rendering errors

---

## Test Layer Mapping

### Layer 1: Unit Tests (Pure Logic)

**Location**: `src/__tests__/` with feature subdirectories

#### Auth & Identity

- `src/__tests__/auth/session-expiry.test.ts` — JWT expiry edge cases
- `src/__tests__/auth/scope-validation.test.ts` — Farm/district isolation

#### Quota & Policy

- `src/__tests__/quota/hard-block-boundary.test.ts` — 100% enforcement
- `src/__tests__/quota/calculation.test.ts` — Math correctness

#### AI & Irrigation

- `src/__tests__/ai/cascade-selection.test.ts` — Model priority
- `src/__tests__/ai/output-validation.test.ts` — Schema enforcement
- `src/__tests__/ai/temperature-zero.test.ts` — Determinism

#### Forecast

- `src/__tests__/forecast/plausibility.test.ts` — 2-year window
- `src/__tests__/forecast/trajectory-validation.test.ts` — Impossible paths

#### Data & Time

- `src/__tests__/timescaledb/bucket-aggregation.test.ts` — Boundary correctness
- `src/__tests__/data/deduplication.test.ts` — Idempotency

#### Math (FAO-56)

- `src/__tests__/fao56/et0-reference.test.ts` — Published example
- `src/__tests__/fao56/et0-precision.test.ts` — Precision targets

### Layer 2: Domain Service Tests

**Location**: `src/__tests__/integration/services/`

#### Ingest Orchestration

- `src/__tests__/integration/services/ingest-orchestration.test.ts`
  - test: `ingest_rejects_cross_well_api_key_use`
  - test: `ingest_accepts_batch_49_50_51_without_off_by_one`
  - test: `ingest_rejects_duplicate_sensorId_timestamp`
  - test: `ingest_rotates_and_revokes_keys`
  - test: `ingest_enforces_rate_limit`

#### Quota Decision

- `src/__tests__/integration/services/quota-decision.test.ts`
  - test: `quota_hard_block_at_100_percent`
  - test: `quota_allows_within_balance`

#### Role & Scope

- `src/__tests__/integration/services/role-scope-enforcement.test.ts`
  - test: `farmer_cannot_read_other_farms`
  - test: `district_admin_cannot_cross_access`
  - test: `role_reduction_invalidates_session`

#### Audit

- `src/__tests__/integration/services/audit-enforcement.test.ts`
  - test: `audit_rejects_update_operations`
  - test: `audit_rejects_delete_operations`
  - test: `sensitive_mutation_requires_audit`

#### AI & Forecasting

- `src/__tests__/integration/services/ai-orchestration.test.ts`
  - Test model cascade (stubbed OpenRouter)
  - Test fallback on retryable errors
  - Test output validation

### Layer 3: Integration Tests (Real DB)

**Location**: `__checks__/integration/` or `src/__tests__/integration/`

#### tRPC Router Tests

- `src/__tests__/integration/routers/sensors.router.test.ts`
  - Ingest endpoint with boundary conditions
  - Authorization enforcement

- `src/__tests__/integration/routers/quota.router.test.ts`
  - Quota decision endpoint
  - Boundary at exactly 100%

- `src/__tests__/integration/routers/users.router.test.ts`
  - Provisioning workflows
  - Role assignment and scope

#### Database & Query Tests

- `src/__tests__/integration/db/timescaledb-aggregation.test.ts`
  - Boundary bucket grouping
  - Chunk compression safety
  - Continuous aggregate staleness

- `src/__tests__/integration/db/audit-immutability.test.ts`
  - INSERT-only constraint
  - UPDATE rejection
  - DELETE rejection

#### Workflow Tests

- `src/__tests__/integration/workflows/cron-simulation.test.ts`
  - RunId isolation
  - Idempotency on replay

### Layer 4: Browser E2E Tests

**Location**: `__checks__/` (Playwright)

#### Page Objects & Scenarios

- `__checks__/support/dashboard-page.ts` — Dashboard POM
- `__checks__/support/admin-page.ts` — Admin management POM
- `__checks__/support/reporting-page.ts` — Reporting workflows POM

#### Test Specs

- `__checks__/dashboard.spec.ts` — Dashboard rendering, data display
- `__checks__/admin.spec.ts` — User provisioning, role assignment
- `__checks__/reporting.spec.ts` — Report generation, export, download

### Layer 5: Synthetic Checks

**Location**: `__checks__/` (Checkly)

- `__checks__/checks/auth-flow.check.ts` — Session handling
- `__checks__/checks/ingest-api.check.ts` — API availability
- `__checks__/checks/quota-api.check.ts` — Quota endpoint
- `__checks__/checks/reporting-export.check.ts` — Export endpoint
- `__checks__/checks/security-headers.check.ts` — Security posture

---

## Test Summary by Invariant

| Invariant                             | Layer                | File                                                     | Test Name                                                |
| ------------------------------------- | -------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| 1. Ingest authorization sensor-scoped | Integration (domain) | `ingest-orchestration.test.ts`                           | `ingest_rejects_cross_well_api_key_use`                  |
| 2. Ingest batch boundaries            | Integration (domain) | `ingest-orchestration.test.ts`                           | `ingest_accepts_batch_49_50_51_without_off_by_one`       |
| 3. Duplicate readings idempotent      | Unit + Integration   | `deduplication.test.ts` + `ingest-orchestration.test.ts` | `ingest_rejects_duplicate_sensorId_timestamp`            |
| 4. Quota hard block at 100%           | Unit + Integration   | `hard-block-boundary.test.ts` + `quota-decision.test.ts` | `quota_hard_block_at_100_percent`                        |
| 5. Audit logs append-only             | Integration          | `audit-immutability.test.ts`                             | `audit_rejects_update_operations`                        |
| 6. Role scope session-scoped          | Integration (domain) | `role-scope-enforcement.test.ts`                         | `role_reduction_invalidates_session`                     |
| 7. AI output schema-valid             | Unit + Integration   | `ai-contracts.test.ts`                                   | `ai_schema_rejects_malformed_json_and_missing_fields`    |
| 8. Forecast scientifically plausible  | Unit + Integration   | `forecast-plausibility-contract.test.ts`                 | `forecast_rejects_physically_impossible_trajectory`      |
| 9. TimescaleDB aggregation correct    | Integration          | `timescaledb-aggregation.test.ts`                        | `timescaledb_time_bucket_groups_boundary_rows_correctly` |
| 10. Demo mode isolated                | Integration (domain) | `cron-simulation.test.ts`                                | `cron_simulation_isolated_by_runId`                      |
| 11. FAO-56 ET₀ reference correct      | Unit                 | `et0-reference.test.ts`                                  | `fao56_et0_matches_reference_example`                    |

---

## Implementation Sequence (Recommended)

**Week 1: Tier 0 Foundations**

1. Unit tests for quota, auth, FAO-56 ET₀
2. Domain service tests for ingest authorization, quota decision, role/scope
3. Audit immutability integration tests
4. Basic browser test for login + dashboard nav

**Week 2: AI & Forecast**

1. Unit tests for AI cascade, output validation
2. Unit tests for forecast plausibility
3. Domain tests for AI orchestration with stubs
4. Integration with recorded OpenRouter fixtures

**Week 3: TimescaleDB & Data**

1. TimescaleDB boundary tests
2. End-to-end ingest pipeline with persistent storage
3. Alert trigger and auto-escalation tests

**Week 4: Cron & Reporting**

1. Cron idempotency and runId isolation
2. Report generation determinism
3. Synthetic checks for API availability and heartbeat
4. Dashboard and admin E2E scenarios

---

## Test Execution Gates

### Pre-Commit

```bash
pnpm tsc --noEmit  # TypeScript
pnpm lint           # ESLint
pnpm test unit      # Unit tests (< 10 seconds)
```

### Pre-Push / CI

```bash
pnpm test           # All layers except E2E
pnpm exec playwright test --project=chromium  # E2E smoke
```

### Pre-Release

```bash
pnpm test           # All tests
pnpm exec playwright test --project=chromium,firefox,webkit  # Full browser matrix
npx checkly trigger # Synthetic checks in staging
```

---

## Progress Tracking

As tests are implemented, mark completion here:

### Phase 1: Tier 0 Foundations

- [ ] Auth & Session (3 tests)
- [ ] Ingest Authorization (4 tests)
- [ ] Quota Enforcement (3 tests)
- [x] Audit Immutability (3 tests)
- [ ] Role & Scope (3 tests)

### Phase 2: AI & Forecast

- [x] AI Cascade (3 tests)
- [x] AI Output Validation (3 tests)
- [x] Forecast Plausibility (2 tests)

### Phase 3: TimescaleDB

- [x] TimescaleDB Aggregation (3 tests)
- [ ] Ingest Pipeline Integration (3 tests)

### Phase 4: Cron & Ops

- [ ] Cron Idempotency (3 tests)
- [ ] Demo Mode Isolation (2 tests)

### Phase 5: Reporting & Workflows

- [ ] Report Generation (3 tests)
- [ ] Notifications (2 tests)

**Total**: ~49 named tests covering all 11 invariants + 5 named subsystem contracts

...
