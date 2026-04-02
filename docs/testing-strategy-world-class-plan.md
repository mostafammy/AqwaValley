---
title: AqwaValley World-Class Testing Strategy
owner: Platform Engineering + QA
status: Draft for Engineering Review
last_updated: 2026-04-02
---

## Executive Summary

This document defines a production-grade testing strategy for AqwaValley.
The goal is to make the platform demonstrably safe, deterministic, and
release-ready across API, UI, data, background jobs, and integrations.

The strategy is designed to support the current stack:

- Next.js App Router frontend and server rendering
- tRPC-based application and API boundaries
- Drizzle-backed persistence and TimescaleDB workloads
- Sensor ingest, alerting, quota, reporting, and cron workflows
- Playwright and Checkly for browser and synthetic checks

This plan applies SOLID principles to test design as well as product code.
Each test layer should have one responsibility, narrow interfaces, isolated
fixtures, and composable helpers that are easy to evolve without rewriting the
entire suite.

## Testing Vision

The testing program must answer four questions with evidence:

1. Does the system do the right thing?
2. Does it keep doing the right thing under load, retries, and failures?
3. Can the team detect regressions before users do?
4. Can the team explain and reproduce every important failure?

If a feature cannot be tested in an automated way, the strategy should define
the smallest reliable manual or synthetic fallback and a path to automation.

## What Makes This World Class

The testing strategy is world class when it is:

- Risk-based instead of coverage-based noise
- Deterministic instead of flaky
- Layered instead of monolithic
- Fast enough to run on every meaningful change
- Observable enough to diagnose failures quickly
- Aligned with the domain model and not just the UI
- Explicit about production behavior, not only happy paths

## Current Repository Reality

The repository already contains a strong foundation that should be used rather
than duplicated:

- Playwright configuration in [playwright.config.ts](../playwright.config.ts)
- Checkly configuration in [checkly.config.ts](../checkly.config.ts)
- Existing end-to-end checks in [__checks__/](../__checks__)
- Scenario scripts in [scripts/](../scripts)
- Domain documentation for ingest, quotas, reporting, and user management in
  [docs/](../docs)

The current gap is not absence of tools. The gap is the lack of a coherent test
architecture, explicit quality gates, and a prioritized test matrix that maps
to real production risk.

## AquaValley Invariant Registry

Every item in this registry must have at least one named automated test.

1. Ingest authorization must be sensor-scoped.
- Given an API key attached to well A, a payload for sensor on well B must be
  rejected and must not write a reading, quota event, or alert.

2. Ingest batch boundaries must be explicit.
- Given batch sizes of 49, 50, 51, and 1,312 readings, the ingest pipeline must
  preserve correctness and respect the deployment runtime envelope.

3. Duplicate readings must be idempotent.
- Given the same sensorId and timestamp, the system must not create duplicate
  persisted readings or duplicate downstream alerts.

4. Quota hard block must remain enforceable.
- Given a farm or district at or above 100 percent utilization, the policy gate
  must produce a blocked or exceeded decision and preserve prior balances.

5. Audit logs must be append-only.
- Given any attempt to UPDATE or DELETE audit records, the database must reject
  the mutation and the application must surface a compliance failure.

6. Role scope must remain session-scoped.
- Given a user with access to farm X, manipulated farmId or districtId payloads
  must not cross into farm Y or another district.

7. AI output must be schema-valid and traceable.
- Given a successful irrigation recommendation, the response must satisfy the
  Zod contract, store modelUsed, preserve reasoning, and be reproducible at
  temperature 0 for the same inputs.

8. Forecast outputs must remain scientifically plausible.
- Given known historical depletion anchors, the forecast engine must stay
  within a plus or minus 2 year window of the Kharga critical-depth reference
  projection and cannot generate physically impossible trajectories.

9. TimescaleDB aggregation must be time-bucket correct.
- Given boundary timestamps and chunk edges, queries must group into the correct
  bucket and never drop or double count boundary rows.

10. Demo and production simulation modes must remain isolated.
- Given SimulatorHeartbeat or cron-driven simulation traffic, test runs must not
  contaminate production-like fixtures and vice versa.

11. FAO-56 ET₀ calculation must match reference outputs.
- Given the published FAO-56 reference inputs, the ET₀ calculation must match
  the expected output within accepted precision for agronomic decision-making.

## Core Principles

### 1. Test the Contract, Not the Accident

Tests should validate business rules, API contracts, and critical workflows,
not incidental implementation details. UI selectors, internal helper names, and
temporary state shapes should not become long-term dependencies.

### 2. Use the Pyramid, Not the Iceberg

Most checks should be fast, local, and narrowly scoped. End-to-end tests should
cover the most important user journeys, not every branch.

Recommended distribution:

- 65% unit and domain tests
- 20% integration tests
- 10% end-to-end and synthetic tests
- 5% exploratory, visual, and manual validation

### 3. Design for Failure

Every critical flow should be tested for:

- validation failures
- authorization failures
- retry behavior
- timeout behavior
- duplicate submission behavior
- partial persistence and recovery
- idempotency

### 4. Keep Tests SOLID

Test code should follow the same discipline as product code:

- Single Responsibility: one test file, one capability
- Open/Closed: extend with builders and strategies, not copy-paste branches
- Liskov Substitution: replace fakes and adapters without changing test intent
- Interface Segregation: use small fixture contracts, not giant shared helpers
- Dependency Inversion: tests depend on abstractions and scenario builders, not
  on concrete implementation details

### 5. Measure coverage by invariants, not percentages alone

Coverage percentage is useful but not sufficient. The quality bar for this code
base must also include:

- every Tier 0 invariant above has a named automated test
- every policy engine mutation is killed by tests or flagged by mutation runs
- every critical integration path has a failure-case test, not only a happy path
- every bug fix in auth, ingest, quota, AI, or reporting adds a permanent
  regression test before merge

Recommended quality targets:

- Tier 0 invariant coverage: 100 percent
- mutation score on pure policy modules: at least 80 percent
- flaky test budget for release-blocking suites: zero

## Quality Gates

No release should proceed unless the following gates are satisfied:

1. TypeScript typecheck passes.
2. Lint and format checks pass.
3. Domain unit tests pass for changed modules.
4. Integration tests pass for impacted flows.
5. Playwright smoke tests pass for critical user journeys.
6. Checkly synthetic checks are green for deployed environments.
7. Any migration or schema change has a dedicated regression test.
8. Any critical bug fix has a test that fails before the fix and passes after.

## Test Layers

### Layer 1: Unit Tests

Purpose:

- Validate pure business logic
- Exercise edge cases cheaply
- Run quickly on every save and every pull request

Targets:

- validators
- policy engines
- quota calculations
- FAO-56 ET₀ calculation
- alert threshold evaluation
- report formatting logic
- date and time boundary logic
- deterministic helpers

Rules:

- No network calls
- No real database dependency
- No UI rendering unless a component is truly pure
- Use table-driven cases for boundary conditions

### Layer 2: Domain Service Tests

Purpose:

- Validate orchestrators, use-case services, and invariants
- Ensure service boundaries behave consistently across adapters

Targets:

- ingest orchestration
- role and scope transitions
- quota decision logic
- report generation pipelines
- cron job handlers
- idempotency and replay logic

Rules:

- Use repository and transport fakes behind interfaces
- Verify error translation and retry semantics
- Assert observable outputs, not private helper calls

### Layer 3: Integration Tests

Purpose:

- Validate real wiring between services, DB, and external integrations
- Catch schema, transaction, and serialization problems

Targets:

- tRPC routers
- Drizzle queries and migrations
- TimescaleDB behaviors
- ingest API
- report generation API
- user provisioning flows
- cron simulation endpoints

Rules:

- Use a controlled test database or isolated schema
- Seed with minimal, realistic fixtures
- Reset state between runs
- Prefer repeatable data builders over ad hoc inserts
- Use stubbed or recorded OpenRouter responses in CI integration tests; reserve
  live model calls for a dedicated smoke lane.

### Layer 4: Browser and E2E Tests

Purpose:

- Validate the most important user journeys in the real UI
- Catch routing, hydration, auth, and accessibility regressions

Targets:

- login and role-based routing
- dashboard rendering
- admin management workflows
- reporting workflows
- mobile responsiveness for key pages

Rules:

- Keep scenarios short and business-focused
- Test only stable, high-value flows
- Avoid asserting exact CSS unless it is accessibility-critical
- Use semantic locators and accessible names first

### Layer 5: Synthetic Monitoring

Purpose:

- Continuously validate the production surface from the outside

Targets:

- homepage availability
- health and heartbeat endpoints
- key authenticated browser journeys
- security headers
- deployment readiness

Rules:

- Checks must be safe to run in production
- No destructive writes
- Use the smallest data footprint possible

### Layer 6: Non-Functional Tests

Purpose:

- Prove the platform behaves under real-world constraints

Targets:

- load and soak testing
- database query performance
- retry and timeout handling
- memory growth and leak detection
- cron reliability
- accessibility and responsiveness

## Named Subsystem Test Contracts

### 1. Sensor Ingest Contract

This is the highest-blast-radius subsystem in the platform and deserves named
tests that encode exact behavior.

Required named assertions:

- `ingest_rejects_cross_well_api_key_use`
- `ingest_accepts_batch_49_50_51_without_off_by_one_regression`
- `ingest_rejects_duplicate_sensorId_timestamp_pairs`
- `ingest_rotates_and_revokes_api_keys_without_reusing_old_keys`
- `ingest_enforces_rate_limit_on_api_ingest_path`
- `ingest_warning_auto_escalates_to_critical_after_2h_unacknowledged`
- `ingest_preserves_alert_deduplication_window`
- `cron_simulation_isolated_from_demo_mode_and_production_mode`

Assertion details:

- Given a reading for well B with a well A key, the request must return a
  rejection and must not persist any reading row.
- Given a batch of exactly 50 valid readings, the request must succeed without
  splitting or truncating the batch.
- Given a batch of 51 readings, the system must follow the documented batch
  strategy rather than silently dropping the overflow.
- Given repeated sensorId plus timestamp values, only one logical reading must
  survive and the downstream alert count must remain stable.
- Given key revocation, the old key must fail immediately and the rotated key
  must succeed.
- Given rate-limit saturation, /api/sensors/ingest must return 429 and avoid
  partial writes.
- Given a warning remains unacknowledged for 2 hours, the system must
  auto-escalate the alert to critical or the next configured severity tier.

### 2. AI Irrigation Engine Contract

The AI layer is advisory but operationally significant because it drives water
usage decisions. It needs explicit test coverage, not just generic integration
checks.

Required named assertions:

- `ai_cascade_uses_llama_then_gemma_then_hermes_then_rule_based_etc`
- `ai_falls_back_only_on_retryable_openrouter_errors`
- `ai_schema_rejects_malformed_json_and_missing_fields`
- `ai_temperature_zero_is_deterministic_for_same_inputs`
- `ai_rejects_quota_exceeding_recommendation_before_persisting`
- `ai_blocks_prompt_injection_from_user_supplied_crop_text`
- `ai_persists_model_used_and_recommendation_traceability`

Assertion details:

- Given a 429 or 503 from the primary model, the system must attempt the next
  model in the documented cascade and must preserve output validation.
- Given a non-retryable error such as invalid credentials or malformed JSON,
  the system must fail fast and must not silently skip the error.
- Given the same farm, soil, ET₀, and quota inputs, temperature 0 must return a
  repeatable plan and the stored recommendation should match the same schema.
- Given a recommendation that exceeds the available quota balance, the system
  must either scale down safely or reject the output before persistence.
- Integration tests must use a recorded HTTP fixture or in-process stub for
  OpenRouter. Live OpenRouter calls are allowed only in a separate smoke suite
  with a dedicated test key and explicit rate-limit guardrails.

Model cascade to enforce in tests:

- meta-llama/llama-3.3-70b-instruct:free
- google/gemma-3-27b-it:free
- nousresearch/hermes-3-405b:free
- rule-based ET₀ fallback

### 3. Forecast and Compliance Contract

The aquifer forecast and compliance surfaces need a distinct test contract.

Required named assertions:

- `forecast_regresses_against_known_depletion_anchor`
- `forecast_rejects_physically_impossible_trajectory`
- `forecast_respects_plausibility_rule_versioning`
- `audit_log_is_insert_only_and_rejects_update_delete`
- `pdpl_retention_rule_blocks_forbidden_data_retention`

Assertion details:

- Given validated historical depletion anchors, the forecast output must remain
  within a plus or minus 2 year window of the Kharga critical-depth reference
  projection and cannot generate physically impossible trajectories.
- Given UPDATE or DELETE attempts against audit logs, the DB user must receive
  a hard rejection and the application must treat it as a compliance failure.
- For this strategy, forbidden retention means personal or operational records
  that are no longer required for the active farmer or staff relationship,
  including recommendation history, audit references, and linked identifiers,
  persisted beyond the policy-defined retention window or outside approved legal
  hold scope. The test must verify that deletion, masking, or archival occurs
  for expired records and that only explicitly retained data remains queryable.

### 4. TimescaleDB Contract

TimescaleDB is not just another database. It needs its own correctness checks.

Required named assertions:

- `timescaledb_time_bucket_groups_boundary_rows_correctly`
- `timescaledb_chunk_boundary_queries_do_not_double_count`
- `timescaledb_continuous_aggregate_refresh_has_known_staleness_window`
- `timescaledb_hypertable_compression_does_not_change_query_semantics`

Assertion details:

- Given readings that straddle a bucket boundary, the dashboard must place them
  into the correct time bucket exactly once.
- Given compressed historical partitions, query results must remain identical
  to the uncompressed baseline for the same logical time range.
- Given a continuous aggregate refresh window, the strategy must verify the
  allowable staleness rather than assuming instant freshness.

### 5. Demo Mode and Cron Isolation Contract

The repository has two simulation contexts: scheduled cron simulation and local
or demo-style simulation. They must stay isolated.

Required named assertions:

- `demo_mode_reads_do_not_write_production_fixtures`
- `cron_simulation_isolated_by_run_identifier`
- `simulator_heartbeat_failure_does_not_mask_real_cron_failure`
- `demo_fixtures_do_not_pollute_integration_database`

Assertion details:

- Given demo-mode traffic, the test database must be isolated by runId or
  schema and must be reset after execution.
- Given a cron failure, the test harness must assert the failure path, not just
  the returned HTTP status.
- Given a demo-mode request, the system must not alter production-like seed data.

## Security Test Map

The security section must be tied to concrete threat-style regressions.

### Spoofing

- `auth_rejects_stolen_or_expired_session`
- `api_key_rotation_invalidates_old_sensor_key`

### Tampering

- `audit_log_is_insert_only_and_rejects_update_delete`
- `ingest_rejects_payload_tampering_across_well_scope`

### Repudiation

- `sensitive_mutation_requires_audit_record`
- `admin_action_without_audit_is_failed`

### Information Disclosure

- `farmer_cannot_read_other_farms_data_via_manipulated_farmId`
- `district_admin_cannot_cross_access_other_district_records`
- `download_links_expire_and_fail_after_ttl`

### Denial of Service

- `ingest_enforces_rate_limit_on_api_ingest_path`
- `cron_simulation_aborts_on_invalid_batch_size_before_heavy_work`

### Elevation of Privilege

- `valve_or_sensitive_control_requires_step_up_authorization`
- `role_reduction_invalidates_privileged_session_state`

Each threat class should have at least one passing test, one negative test, and
one regression assertion tied to a real user flow.

## Priority Test Matrix

### Tier 0: Must Never Break

- Authentication and session handling
- Authorization and scope checks
- Sensor ingest acceptance and rejection behavior
- Quota enforcement and threshold decisions
- Report generation and export correctness
- User provisioning and role management
- Cron scheduling and idempotency
- AI irrigation cascade and fallback correctness
- Forecast plausibility and audit immutability
- TimescaleDB aggregation semantics

### Tier 1: High Value

- Dashboard and management pages
- Search, filtering, pagination, and sorting
- Notification and email workflows
- Audit trail visibility
- Error boundaries and fallback states
- PDF/CSV export integrity and reproducibility

### Tier 2: Important But Not Release Blocking

- Nice-to-have UI interactions
- Secondary charts and visualization polish
- Non-critical admin utilities
- Rare edge flows with low blast radius

## Critical Journeys To Automate

The following journeys should be present in automated coverage early:

1. User logs in and lands on the correct role-based experience.
2. Admin provisions a user and the account is auditable.
3. Sensor ingest accepts valid readings and rejects invalid or unauthorized data.
4. Quota and threshold decisions produce the correct result at boundaries.
5. A report is generated, exported, and retrieved successfully.
6. A scheduled job runs, is idempotent, and records its status.
7. A deployed site passes smoke checks, security checks, and basic navigation.

## Coverage By Domain

### Authentication and Identity

What to test:

- session creation and expiry
- password reset and invitation flows
- role-based redirects
- protected route enforcement
- auth failure states and audit events
- JWT expiry enforcement after privilege changes
- cross-district admin access rejection
- BetterAuth-to-Lucia migration compatibility if the auth layer changes

Concrete assertions:

- Given an expired JWT or session, the request must be denied without exposing
  protected data.
- Given a user from one district and a manipulated districtId payload, the
  server must return a denial and keep the original scope unchanged.

### Ingest and Time-Series Data

What to test:

- valid and invalid API key handling
- batch ingest acceptance limits
- duplicate reading handling
- TimescaleDB persistence and querying
- alert trigger logic and suppression windows
- denormalized read models remaining consistent enough for the UI
- sensor API key revocation and rotation behavior
- warning auto-escalation after 2h where applicable

Concrete assertions:

- Given flow rate greater than 130 percent of baseline, the pipeline must write
  a critical alert within one ingestion cycle and preserve the original
  reading.
- Given a sensor key that has been revoked, a reused request must fail even if
  the payload is otherwise valid.
- Given a batch size over the documented boundary, the pipeline must not exceed
  the safety envelope without an explicit policy decision.

### Quotas and Governance

What to test:

- quota calculation boundaries
- farm and district scope correctness
- ABAC enforcement
- historical decision reproducibility
- audit trail completeness
- quota hard-block behavior when utilization reaches 100 percent

Concrete assertions:

- Given a farm with 10,000L monthly quota and 9,500L used, a 600L trigger must
  be rejected by the policy gate and must leave quota balance unchanged.
- Given a district at or above 100 percent utilization, the effective state
  must reflect blocked or exceeded according to the runtime policy.

### Reporting

What to test:

- report parameter validation
- async job lifecycle
- deterministic exports
- access control on download links
- large data volume behavior

Concrete assertions:

- Given the same snapshotId and template version, export artifacts must be
  reproducible and yield the same SHA-256 integrity hash.
- Given a download after expiry, the link must fail and the access event must
  still be auditable.

### Frontend and UX

What to test:

- critical page load and render states
- loading, empty, and error states
- form validation and submission feedback
- responsive layout for tablet and mobile sizes
- accessibility basics such as labels, headings, contrast, and keyboard flow

Concrete assertions:

- Given a validation error, the form must render an actionable message and keep
  the user’s inputs intact.
- Given mobile viewport widths, the dashboard must remain usable without
  horizontal overflow for Tier 0 pages.

### Operational Jobs and Cron

What to test:

- scheduled execution
- retry behavior
- replay safety
- dead-letter or failure reporting
- observability output

Concrete assertions:

- Given a cron run, the test must assert the resulting ingestion_log entry, not
  just the returned HTTP status.
- Given a retry, the same run identifier must not double-ingest data.
- Given a failure, the test must capture the failure class and the recovery
  behavior, not only the exception text.

## Test Data Strategy

### Data Principles

- Use minimal fixtures that still look like production.
- Prefer domain builders over large static SQL dumps.
- Make every important scenario reproducible by seed name.
- Keep dates, IDs, and time windows deterministic.
- Test data should make the failure obvious when it fails.

### Fixture Design

Recommended fixture patterns:

- `buildUserScenario()` with explicit districtId, role, and forbidden scope
  combinations
- `buildWellScenario()` with sensor health, baseline flow, and anomaly inputs
- `buildQuotaScenario()` with exact 49 percent, 100 percent, and 101 percent
  utilization paths
- `buildReportScenario()` with fixed snapshotId, policyVersion, and export type
- `buildCronScenario()` with runId, mode, and deterministic sensor values

Fixture rules:

- Small, composable, and explicit
- No hidden global state
- No cross-test mutation
- Reset or isolate per test run

## Tooling Strategy

### Fast Feedback

- TypeScript type checking
- ESLint and formatting
- targeted unit tests on changed files

### Integration and Contract Validation

- tRPC router tests
- database-backed integration tests
- migration verification
- API contract checks for sensitive endpoints

### Browser and Monitoring

- Playwright for local and CI browser journeys
- Checkly for deployed monitoring and smoke coverage

### Performance and Reliability

- load tests for ingest and reporting paths
- query plan checks for heavy aggregations
- cron retry and recovery tests
- mutation testing or mutation-like checks for policy modules

## Evidence Quality Bar

Tests are only useful if they prove the invariant, not just the implementation.

Required evidence for critical regressions:

- one named assertion per business invariant
- one negative test per security control
- one failure-path assertion for each retryable integration
- one reproducible seed or fixture name per incident class
- one traceable artifact for AI and report generation outputs

This means the suite should be organized around invariant coverage rather than
just file or component coverage.

## CI Strategy

The CI pipeline should be staged so developers get fast signal first and
expensive checks only after the cheap gates pass.

Recommended order:

1. Install dependencies.
2. Run formatting and lint checks.
3. Run typecheck.
4. Run unit and service tests.
5. Run integration tests.
6. Run Playwright smoke suite.
7. Publish artifacts and reports.
8. Trigger or validate Checkly checks for deployed environments.
9. Run a focused regression pack for the subsystem changed in the PR.

Rules:

- Fail fast on static checks.
- Run broad integration only when relevant paths change, if feasible.
- Cache dependencies and browser assets.
- Keep CI output readable and actionable.

## Observability For Tests

Every serious test failure should leave evidence:

- structured logs
- screenshots for UI failures
- traces for browser failures
- response payload snapshots for API failures
- database seed names and run identifiers
- clear error classification for flaky versus deterministic failures

If a test fails, the developer should immediately know:

- what failed
- where it failed
- which scenario was under test
- what the expected contract was
- how to reproduce it locally

## Flakiness Policy

Flaky tests are production risk. Treat them as defects.

Policy:

- A flaky test must be isolated within the same day it is reported.
- If the root cause is unknown, quarantine it with an owner and expiry date.
- Do not keep rerunning a flaky test as a substitute for fixing it.
- Every flaky failure must end in a durable fix or removal.

Common causes to eliminate:

- time-based waits without explicit readiness checks
- shared mutable fixtures
- nondeterministic order assumptions
- external service dependency without a stub or sandbox
- brittle selectors in browser tests

## Accessibility And UX Validation

The UI is part of the product contract.

Test for:

- keyboard-only navigation
- semantic headings and labels
- form error announcement behavior
- visible focus states
- mobile layout integrity
- basic contrast and text scaling

Accessibility checks should not be an afterthought or a separate project.
They belong in smoke coverage for critical pages.

## Security-Focused Testing

Security is a testing concern, not only a code review concern.

Validate:

- unauthorized access is rejected
- tenant and district boundaries are enforced
- sensitive mutation flows create audit records
- tokens expire and cannot be reused
- rate limits and abuse protections behave as expected
- download links are protected and time bound
- audit immutability is enforced at the database privilege layer

## Performance-Focused Testing

Performance tests should target the places where AqwaValley can hurt users:

- ingest throughput
- report generation time
- dashboard list queries
- cron execution duration
- auth and redirect latency
- continuous aggregate freshness and recomputation lag

Performance rules:

- Measure before optimizing.
- Define a baseline and compare against it.
- Test the query shape, not only the endpoint latency.
- Keep the critical path free of unnecessary blocking work.

## Roles And Ownership

The team should own tests the same way it owns code.

- Feature owners maintain unit and integration coverage for their area.
- Platform engineering owns shared fixtures, test utilities, and CI gates.
- QA owns high-value E2E journeys, synthetic checks, and release validation.
- Security reviews auth and abuse-case coverage.

## Release Readiness Checklist

Before merging a risky change or releasing to production:

1. Changed code has unit coverage.
2. Changed flows have integration coverage.
3. High-risk UI journeys have browser coverage.
4. Migrations or schema updates have rollback-aware validation.
5. Observability for the change exists.
6. Failure modes are documented.
7. The team can reproduce the change locally.
8. Tier 0 invariant tests pass for the impacted subsystem.
9. Mutation and negative-case checks exist for the changed policy logic.

## Team Implementation Checklist

Use this checklist in order when turning the strategy into delivery work.

### 1. Freeze the invariant registry

- Confirm the AquaValley Invariant Registry is the source of truth.
- Assign a test owner to each invariant.
- Create or update a test file for every Tier 0 invariant.
- Exit when each invariant has at least one named automated test.
- Entry criteria: the repository must have a working local dev environment, a
  documented test database path, and access to the fixture harness PR.

### 2. Build the shared harness

- Create deterministic fixture builders for users, wells, quotas, reports, AI, and cron.
- Add isolated databases or schemas for integration and simulation tests.
- Standardize seed names and run identifiers.
- Exit when every critical scenario can be reproduced from fixtures alone.
- Local prerequisites: Docker Compose with TimescaleDB and PostgreSQL, the
  documented `.env.local` values, and a clean seeded test database.

### 3. Lock down ingest behavior

- Implement sensor-scoped authorization checks.
- Add batch boundary coverage for 49, 50, 51, and 1,312 readings.
- Prove duplicate reading idempotency.
- Prove API key rotation and revocation behavior.
- Prove rate-limit saturation returns 429 without partial writes.
- Exit when ingest regressions cannot sneak through the boundary cases.

### 4. Lock down security and access control

- Add session expiry tests.
- Add cross-district and cross-farm denial tests.
- Add step-up authorization tests for sensitive actions.
- Add audit immutability tests at the database privilege layer.
- Exit when spoofing, tampering, repudiation, disclosure, DoS, and privilege escalation checks are green.

### 5. Add AI and forecast contracts

- Add model cascade fallback tests for OpenRouter.
- Add Zod validation tests for AI output.
- Add temperature 0 determinism checks.
- Add quota-safe recommendation tests.
- Add forecast anchor regression and plausibility tests.
- Add PDPL retention and audit traceability tests.
- Exit when AI and forecast outputs are safe, reproducible, and traceable.

### 6. Validate TimescaleDB and reporting

- Add time-bucket and chunk-boundary tests.
- Add continuous aggregate staleness checks.
- Add compression-semantic checks.
- Add report snapshot reproducibility and SHA-256 integrity hash tests.
- Exit when analytical reads and exports are deterministic.

### 7. Cover cron, observability, and demo isolation

- Assert ingestion_log output for cron runs.
- Verify retry, replay, and failure-class handling.
- Isolate SimulatorHeartbeat and demo traffic from production-like fixtures.
- Exit when scheduled jobs are reproducible and non-destructive.

### 8. Wire CI and release gates

- Make typecheck, lint, unit, integration, Playwright, and Checkly required.
- Publish traces, screenshots, run IDs, and seed names for failures.
- Add a focused regression pack for the changed subsystem in every PR.
- Exit when failures are actionable and the pipeline is blocking correctly.

### 9. Add mutation and flake control

- Run mutation testing or mutation-like checks on policy modules.
- Quarantine flaky tests with an owner and expiry date.
- Remove obsolete tests instead of letting them linger.
- Exit when release-blocking suites are stable and signal is trustworthy.

## QA Test Matrix By Subsystem

| Subsystem | Primary invariants | Test layers | Evidence |
| --- | --- | --- | --- |
| Authentication and Identity | Session expiry, JWT invalidation, cross-district denial, step-up auth, auth provider migration compatibility | Unit, integration, E2E | Router tests, screenshots, auth logs |
| Ingest and Time-Series Data | Sensor-scoped auth, 49/50/51 boundaries, idempotency, alert timing, 2h escalation | Unit, integration, synthetic | Seed names, rate-limit logs, alert rows |
| Quotas and Governance | Hard block at 100 percent, ABAC, audit completeness | Unit, integration, E2E | Snapshot rows, denial traces, policy results |
| AI Irrigation Engine | Model cascade fallback, schema validity, temp 0 determinism, prompt injection resistance | Unit, integration | Stored modelUsed, AI JSON trace, validation errors |
| Forecast and Compliance | Depletion anchor regression, plausibility, audit immutability, PDPL retention | Unit, integration | Forecast baselines, DB rejection evidence |
| TimescaleDB | Bucket correctness, chunk boundaries, compression semantics, aggregate staleness | Integration, performance | Query results, query plans, freshness timestamps |
| Reporting | Snapshot reproducibility, artifact integrity, signed link expiry | Integration, E2E | Integrity hashes, download traces, artifact metadata |
| Cron and Simulator | Run isolation, ingestion_log assertions, retry safety, demo separation | Integration, synthetic | Run IDs, logs, failure classes |
| Frontend and UX | Role routing, validation states, mobile layout, accessibility | E2E, synthetic | Screenshots, accessibility traces, browser logs |

### Matrix Notes

- Tier 0 subsystems must have at least one failing test case per named invariant before the fix.
- Every subsystem should include at least one negative-path assertion.
- E2E coverage is mandatory only for user-visible flows that cannot be proven through lower layers.
- Synthetic checks should mirror production readiness rather than internal implementation details.

## Anti-Patterns To Avoid

- One giant end-to-end suite for everything.
- Heavy shared fixtures that hide state.
- Tests that assert internal implementation details.
- Snapshot tests used where explicit behavior tests are needed.
- Blindly increasing coverage without risk analysis.
- Treating flaky tests as acceptable because they eventually pass.

## Conclusion

AqwaValley should be tested like a production platform, not like a demo.
That means small, deterministic tests for logic; realistic integration tests for
wiring; focused browser coverage for the journeys users care about; and
synthetic monitoring for the deployed system.

The best testing strategy is the one that makes release confidence boring.
This plan is designed to get AqwaValley there.
