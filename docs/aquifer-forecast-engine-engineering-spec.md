---
title: Aquifer Forecast Engine Engineering Spec and Sprint Ticket Plan
owner: Platform + Data Science + Hydrogeology + Product
status: Ready for Sprint Planning
last_updated: 2026-03-29
source_plan: docs/aquifer-forecast-engine-professional-plan.md
---

## Purpose

This companion engineering spec translates the approved architecture plan into
implementation-ready tickets for direct sprint planning. It defines exact
interfaces, classes, migrations, tests, owners, dependencies, and acceptance
criteria.

## Planning Inputs

- Safety-critical governance model is mandatory.
- Phase 2 work cannot start until pre-phase blockers are resolved.
- Daily cron operation must satisfy SLO gates.
- District-level publication is allowed only when lineage is complete.

## Delivery Model

- Sprint length: 2 weeks
- Initial release window: 4 sprints
- Planning unit: story points
- Definition of ready:
  - ticket has owner, estimate, dependencies, and acceptance criteria
  - schema and interface impacts are explicit
  - required reviewers are named
- Definition of done:
  - code merged with tests
  - telemetry added
  - docs updated
  - rollout and runbook notes updated if operational behavior changed

## Ownership Model

| Role | Scope |
|---|---|
| Platform Lead | Service architecture, APIs, cron, repositories, SLO enforcement |
| Data Science Lead | Model training, uncertainty strategy, calibration, drift logic |
| Hydrogeology SME | Plausibility constants, rule approvals, scientific sign-off |
| Product Owner | Policy-facing behavior, UX acceptance, release decision |
| QA Lead | Test strategy execution, non-functional validation |

## Sprint Roadmap

| Sprint | Goal |
|---|---|
| Sprint 1 | Foundations: interfaces, schema, policy constants, lineage model |
| Sprint 2 | Core engine: pipeline chain, trainer, intervals, plausibility, risk evaluator |
| Sprint 3 | API, cron, approval workflow, observability, partial-lineage publish policy |
| Sprint 4 | Validation gates, load tests, shadow mode, go-live readiness review |

## Epic Breakdown

| Epic ID | Epic | Owner |
|---|---|---|
| AFE-EPIC-01 | Architecture Foundations and SOLID Contracts | Platform Lead |
| AFE-EPIC-02 | Persistence and Migration Layer | Platform Lead |
| AFE-EPIC-03 | Forecast Core Engine | Data Science Lead |
| AFE-EPIC-04 | Plausibility and Risk Policy Engine | Hydrogeology SME + Platform Lead |
| AFE-EPIC-05 | API, Cron, and Approval Workflow | Platform Lead |
| AFE-EPIC-06 | Validation, Performance, and Release Gates | QA Lead + Data Science Lead |

## Ticket Backlog

## AFE-EPIC-01 Architecture Foundations and SOLID Contracts

| Ticket ID | Title | Owner | SP | Dependencies |
|---|---|---|---:|---|
| AFE-001 | Define DataSourceAdapter contracts and implementations | Platform | 5 | None |
| AFE-002 | Split feature preparation into normalizer and quality filter | Platform | 3 | AFE-001 |
| AFE-003 | Introduce trainer and quality reporter interfaces | Data Science | 3 | None |
| AFE-004 | Implement interval strategy interfaces and selector | Data Science | 5 | AFE-003 |
| AFE-005 | Define repository interfaces for orchestration boundary | Platform | 3 | AFE-001 |
| AFE-006 | Build ForecastRunFactory and deterministic runKey utility | Platform | 2 | AFE-005 |
| AFE-007 | Add decorator wrappers for telemetry instrumentation | Platform | 3 | AFE-005 |

### AFE-001 Deliverables

- New interfaces and classes:
  - src/server/services/forecast/adapters/DataSourceAdapter.ts
  - src/server/services/forecast/adapters/PostgresAdapter.ts
  - src/server/services/forecast/adapters/TimescaleAdapter.ts
  - src/server/services/forecast/adapters/CEDAREAdapter.ts
  - src/server/services/forecast/HistoricalDataLoader.ts
- Required methods:
  - loadDistrictSeries
  - loadWellTimeseries bulk contract with wellIds array
  - loadExternalReferenceSeries
- Tests:
  - adapter contract tests
  - N+1 regression test that verifies bulk path is used

Acceptance criteria:

1. HistoricalDataLoader compiles without direct DB-specific logic.
2. Bulk well loading executes in bounded query count for 1000 plus wells.
3. Contract tests pass for all registered adapters.

## AFE-EPIC-02 Persistence and Migration Layer

| Ticket ID | Title | Owner | SP | Dependencies |
|---|---|---|---:|---|
| AFE-010 | Add forecast run and model tables in Drizzle schema | Platform | 5 | AFE-005 |
| AFE-011 | Add risk flag and plausibility policy version fields | Platform | 3 | AFE-010 |
| AFE-012 | Add external reference and lineage link tables | Platform | 5 | AFE-010 |
| AFE-013 | Add isEligibleForUse DB view or generated column | Platform | 3 | AFE-010 |
| AFE-014 | Add indexes and constraints for lineage and eligibility | Platform | 3 | AFE-011, AFE-012, AFE-013 |

### AFE-010 to AFE-014 Deliverables

- Schema updates:
  - src/server/db/schema.ts
- Migration files:
  - drizzle/0008_aquifer_forecast_foundation.sql
  - drizzle/0009_aquifer_lineage_and_eligibility.sql
- Repository implementations:
  - src/server/services/forecast/repositories/ForecastArtifactRepository.ts
  - src/server/services/forecast/repositories/RiskFlagRepository.ts
  - src/server/services/forecast/repositories/ModelVersionRepository.ts

Acceptance criteria:

1. Migration applies cleanly on empty and existing databases.
2. Uniqueness and check constraints enforce contract invariants.
3. Eligibility query is unified via DB object, not duplicated in code.

## AFE-EPIC-03 Forecast Core Engine

| Ticket ID | Title | Owner | SP | Dependencies |
|---|---|---|---:|---|
| AFE-020 | Build FeaturePipeline coordinator | Platform | 3 | AFE-002 |
| AFE-021 | Implement LinearRegressionTrainer and quality reporter | Data Science | 5 | AFE-003 |
| AFE-022 | Implement closed-form interval estimator | Data Science | 5 | AFE-004, AFE-021 |
| AFE-023 | Implement bootstrap interval estimator with guardrails | Data Science | 5 | AFE-004, AFE-021 |
| AFE-024 | Implement strategy selector with fallback trigger logic | Data Science | 3 | AFE-022, AFE-023 |
| AFE-025 | Build chain-of-responsibility pipeline handlers | Platform | 5 | AFE-020, AFE-024 |
| AFE-026 | Add training reuse policy and staleness checks | Platform + DS | 3 | AFE-021, AFE-025 |

### AFE-023 Mandatory constants

- MAX_BOOTSTRAP_ITERATIONS
- MAX_BOOTSTRAP_SAMPLE_SIZE
- MAX_MODEL_STALENESS_DAYS

Constants location:

- src/server/services/forecast/policy/forecastPolicy.ts

Acceptance criteria:

1. Selector switches estimators based on calibration policy.
2. Guardrails enforce fail-fast degraded mode when budgets exceed limits.
3. Retraining skip path is active and covered by integration tests.

## AFE-EPIC-04 Plausibility and Risk Policy Engine

| Ticket ID | Title | Owner | SP | Dependencies |
|---|---|---|---:|---|
| AFE-030 | Implement IPlausibilityRule and rule registry | Platform | 3 | AFE-025 |
| AFE-031 | Implement v0 plausibility rules and policy versioning | Hydro + Platform | 5 | AFE-030 |
| AFE-032 | Implement IRiskEvaluator and SQ13 evaluator | Platform | 3 | AFE-025 |
| AFE-033 | Composite flag reducer and reason payload builder | Platform | 2 | AFE-032 |
| AFE-034 | Policy constants approval artifact and changelog template | Hydro | 2 | AFE-031 |

### AFE-031 v0 rules to implement

- max annual recovery rule
- max annual depletion rule
- physical floor rule
- recharge-extraction consistency rule
- boundary continuity rule

Acceptance criteria:

1. Rule registry is version-addressable by plausibilityPolicyVersion.
2. New rule can be added without modifying validator coordinator.
3. Risk outputs include policy version and reason payloads.

## AFE-EPIC-05 API, Cron, and Approval Workflow

| Ticket ID | Title | Owner | SP | Dependencies |
|---|---|---|---:|---|
| AFE-040 | Add forecast query and risk list endpoints | Platform | 5 | AFE-014, AFE-025, AFE-033 |
| AFE-041 | Add on-demand recompute endpoint with role checks | Platform | 3 | AFE-040 |
| AFE-042 | Implement daily cron route and run idempotency behavior | Platform | 5 | AFE-040, AFE-006 |
| AFE-043 | Implement approval state machine service | Platform + Product | 5 | AFE-014 |
| AFE-044 | Add observer event handlers for approval transitions | Platform | 3 | AFE-043 |
| AFE-045 | Implement district-granular partial-lineage publish policy | Platform | 3 | AFE-040, AFE-042 |

### AFE-043 state machine

- States:
  - pending_review
  - approved
  - rejected
  - expired
  - superseded
- Events:
  - ModelApprovedEvent
  - ModelExpiredEvent
  - ModelSupersededEvent
- Handlers:
  - cron unblock update
  - lineage lock update
  - notification dispatch

Acceptance criteria:

1. Cron uses only eligible approved models.
2. Missing eligible model yields blocked_no_approved_model behavior.
3. Partial lineage behavior publishes complete districts only.

## AFE-EPIC-06 Validation, Performance, and Release Gates

| Ticket ID | Title | Owner | SP | Dependencies |
|---|---|---|---:|---|
| AFE-050 | Unit test suite for interfaces and policy logic | QA + Platform | 5 | AFE-007, AFE-033 |
| AFE-051 | Integration tests for migrations and repositories | QA + Platform | 5 | AFE-014 |
| AFE-052 | Scientific backtesting and coverage report pipeline | Data Science | 8 | AFE-024, AFE-031 |
| AFE-053 | Performance and load test harness for SLO pass/fail | QA + Platform | 8 | AFE-042 |
| AFE-054 | Shadow mode dashboards and alert rules | Platform + Product | 5 | AFE-045, AFE-053 |
| AFE-055 | Governance release package and sign-off workflow | Product + Hydro + DS | 3 | AFE-052, AFE-054 |

### AFE-053 test profile

- District execution model:
  - parallel with semaphore MAX_DISTRICT_CONCURRENCY
  - hard timeout DISTRICT_TIMEOUT_MS
- SLO verification targets:
  - P95 daily run <= 25 minutes
  - P99 daily run <= 35 minutes
  - district P95 <= 90 seconds
  - worker P99 RSS <= 1.5 GB
  - failed-run rate <= 1.0 percent

Acceptance criteria:

1. All mandatory SLOs pass on representative load profile.
2. Scientific validation artifact includes interval calibration evidence.
3. Governance sign-off package is complete and approved.

## Interface and Class Checklist

### Required interfaces

- DataSourceAdapter
- IModelTrainer
- IModelQualityReporter
- IIntervalEstimator
- IPlausibilityRule
- IRiskEvaluator
- ForecastArtifactRepository
- RiskFlagRepository
- ModelVersionRepository

### Required classes

- HistoricalDataLoader
- TimeAxisNormalizer
- DataQualityFilter
- FeaturePipeline
- LinearRegressionTrainer
- ModelQualityReporter
- ClosedFormIntervalEstimator
- BootstrapIntervalEstimator
- IntervalEstimatorSelector
- PhysicalPlausibilityValidator
- SQ13RiskEvaluator
- ForecastRunOrchestrator
- ForecastRunFactory

## Test Plan by Layer

| Layer | Test Type | Required Coverage |
|---|---|---|
| Domain policies | Unit | rule boundaries, fallback triggers, state transitions |
| Persistence | Integration | constraints, indexes, eligibility predicate correctness |
| API and cron | Integration | auth, ABAC, idempotency, partial-lineage behavior |
| Forecast quality | Scientific | backtesting, bias, coverage, drift |
| Performance | Load | SLO pass/fail with concurrency and timeout model |

## Sprint Assignment Draft

### Sprint 1 tickets

- AFE-001, AFE-002, AFE-003, AFE-005, AFE-010, AFE-011, AFE-012

### Sprint 2 tickets

- AFE-004, AFE-020, AFE-021, AFE-022, AFE-023, AFE-030, AFE-031, AFE-032

### Sprint 3 tickets

- AFE-024, AFE-025, AFE-026, AFE-033, AFE-040, AFE-041, AFE-042, AFE-043,
  AFE-044, AFE-045

### Sprint 4 tickets

- AFE-013, AFE-014, AFE-050, AFE-051, AFE-052, AFE-053, AFE-054, AFE-055

## Critical Path

1. Adapter and repository contracts
2. Schema and migrations
3. Core engine and policy rule implementation
4. API plus cron plus approval workflow
5. Validation and SLO gate completion
6. Governance approval

## Risks During Execution

1. Hydrology constants not approved before coding
- Mitigation: block AFE-031 merge without signed policy artifact.

2. Bootstrap fallback causes SLO regressions
- Mitigation: enforce guardrails and timeout degraded mode.

3. Eligibility logic diverges across services
- Mitigation: centralize with DB eligibility view and repository predicate.

4. Partial lineage behavior misunderstood by consumers
- Mitigation: explicit status contract in API responses and dashboard labels.

## Direct Planning Actions for Next Meeting

1. Confirm owners by person name for each ticket.
2. Confirm story points and sprint capacity.
3. Freeze policy constants requiring Hydro approval.
4. Approve Sprint 1 commit scope and merge gates.
5. Open tracking board with ticket IDs AFE-001 through AFE-055.
