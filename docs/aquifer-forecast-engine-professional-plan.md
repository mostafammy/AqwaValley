---
title: Aquifer Forecast Engine Professional Plan
owner: Platform + Data Science + Hydrogeology
status: Draft for Architecture and Governance Review
last_updated: 2026-03-29
---

## Executive Summary

This document defines a production-grade implementation plan for the
AquaValley Aquifer Forecast Engine. The engine will generate district-level
forecasts with well-level breakdowns for:

- Aquifer level trajectory
- Extraction versus safe-yield trajectory
- SQ-13 risk flags for 5-year, 10-year, and 25-year horizons
- Composite highest-severity risk flag
- Mandatory uncertainty intervals (80% and 95%)

This is a safety-critical decision-support capability. The release process
requires software validation, scientific validation, and hydrogeology expert
approval before policy-facing usage.

## Problem Statement

Government planners need long-horizon aquifer forecasts to guide allocation,
quota policy, and risk communication. Point forecasts without uncertainty can
cause harmful decisions. Model correctness in code is not sufficient; outputs
must be physically plausible and externally validated against observed aquifer
measurements.

## Business and Public-Sector Outcomes

- Improve district-level water planning with defensible risk signals.
- Reduce under-warning and over-warning events in horizon planning.
- Provide transparent uncertainty and confidence diagnostics.
- Establish audit-ready traceability for regulator and governorate reviews.

## Scope (V1)

- Forecast horizons: 5, 10, 25 years.
- Forecast targets:
  - Aquifer level
  - Extraction versus safe-yield
- Output scope:
  - District-level primary output
  - Well-level breakdown and risk ranking
- Risk outputs:
  - SQ13_5YR, SQ13_10YR, SQ13_25YR
  - SQ13_COMPOSITE (highest severity)
- Execution modes:
  - Daily scheduled run
  - On-demand privileged recompute

## Non-Goals (V1)

- Fully autonomous enforcement actions from model output.
- Non-linear or hybrid ML model families beyond linear regression.
- Farm-level horizon projections as policy-grade outputs.

## Governing Principles

- Safety-first: no policy-facing use without uncertainty and SME sign-off.
- Explainability-first: every risk flag must carry machine-readable reasons.
- Determinism-first: same inputs produce same outputs and replay behavior.
- Least-privilege access: ABAC and role checks for all district and well data.
- Operability-first: strong telemetry, idempotency, and rollback controls.

## Existing System Reuse Strategy

Reuse proven patterns from current codebase:

- Forecast baseline and API wiring:
  - src/server/services/forecastService.ts
  - src/server/api/routers/forecast.ts
- Deterministic evaluation and reasons:
  - src/server/services/alertEvalService.ts
  - src/server/services/quotaDecisionService.ts
- Idempotent run lifecycle and cron orchestration:
  - src/server/services/simulatorRunRegistry.ts
  - src/app/api/cron/simulate-ingest/route.ts
- Data quality and ingest conventions:
  - src/server/services/ingestService.ts
- Authorization and logging:
  - src/server/lib/abac.ts
  - src/lib/logger.ts

## Target Architecture

### Service Components (SOLID)

1. HistoricalDataLoader
- Responsibility: orchestration only for data retrieval and provenance checks.
- Required abstraction:
  - DataSourceAdapter interface with concrete adapters such as PostgresAdapter,
    TimescaleAdapter, and CEDAREAdapter.
- Required bulk contract:
  - loadWellTimeseries(wellIds, windowStart, windowEnd) returns grouped
    well-series in a bulk query path to avoid N+1 query behavior.

2. FeaturePreparationService
- Responsibility split required:
  - TimeAxisNormalizer for time-axis normalization and frequency alignment.
  - DataQualityFilter for missing-value and outlier policy application.
  - FeaturePipeline coordinator to compose both components.

3. LinearRegressionTrainer
- Responsibility: coefficient generation for each target.
- Interface segregation required:
  - IModelTrainer for training output.
  - IModelQualityReporter for quality metrics (for example rSquared, sample
    coverage metrics, and completeness diagnostics).

4. UncertaintyEstimator
- Responsibility: interval generation and interval health diagnostics.
- Strategy abstraction required:
  - IIntervalEstimator interface.
  - ClosedFormIntervalEstimator and BootstrapIntervalEstimator implementations.
  - Selector component that chooses strategy based on policy and calibration.

5. PhysicalPlausibilityValidator
- Responsibility: enforce hydrogeologic guardrails.
- Pattern requirement:
  - Specification pattern via IPlausibilityRule and a versioned rule registry
    keyed by plausibilityPolicyVersion.

6. SQ13RiskEvaluator
- Responsibility: risk mapping for SQ-13 policy.
- Substitutability requirement:
  - IRiskEvaluator contract to support future evaluators without orchestration
    changes.

7. ForecastRunOrchestrator
- Responsibility: pipeline coordination only.
- Persistence separation requirement:
  - ForecastArtifactRepository, RiskFlagRepository, and ModelVersionRepository
    interfaces.
  - No direct SQL or persistence branching in orchestrator.

### Required Design Patterns for Implementation

1. Strategy
- Interval estimator selection and fallback switching.

2. Specification
- Composable plausibility rule evaluation and policy versioning.

3. Repository
- All database operations through repository boundaries.

4. Factory
- ForecastRunFactory for deterministic run creation and runKey consistency.

5. Chain of Responsibility
- Pipeline gate chain: data quality, training, interval estimation,
  plausibility, risk mapping, publish.

6. Observer
- Model approval state transition side-effects (for example cron unblocking,
  lineage lock, operational notifications).

7. Decorator
- Observability wrappers for duration, qualityGateStatus, failureClass, and
  correlation metadata without polluting core logic.

### High-Level Flow

1. Acquire internal telemetry and external reference data.
2. Execute data quality gates.
3. Train or reuse target models.
4. Generate horizon forecasts with intervals.
5. Execute physical plausibility checks.
6. Compute SQ-13 flags and composite severity.
7. Persist run artifacts and diagnostics.
8. Expose API responses and dashboards.

## Data Contracts and Persistence

### New Entities

1. aquifer_forecast_run
- Purpose: execution lifecycle, replay safety, telemetry, and audit trail.
- Key fields:
  - id, runKey, triggerType, triggeredBy
  - scopeType, scopeIds
  - status, startedAt, completedAt, durationMs
  - qualityGateStatus, responseSummary, errorSummary

2. aquifer_linear_regression_model
- Purpose: model versioning and quality artifact persistence.
- Key fields:
  - id, scopeType, scopeId, targetType
  - slope, intercept, rSquared, sampleCount
  - trainingWindowStart, trainingWindowEnd
  - dataCompletenessPct, outlierRatioPct
  - approvalState, approvedBy, approvedAt, approvalExpiresAt

3. aquifer_risk_flag
- Purpose: risk outputs for policy and UI consumption.
- Key fields:
  - id, scopeType, scopeId, targetType
  - flagType (SQ13_5YR, SQ13_10YR, SQ13_25YR, SQ13_COMPOSITE)
  - riskLevel (low, moderate, high, critical)
  - pointForecast, interval80, interval95
  - reasonCodes, computedAt, modelVersionId, runId
  - plausibilityPolicyVersion

4. aquifer_external_reference_observation
- Purpose: external benchmark alignment (CEDARE and RIGW).
- Key fields:
  - id, sourceSystem, stationId, districtId, wellId
  - observedAt, metricType, value, unit
  - mappingConfidence, ingestedAt, sourceSnapshotId

5. aquifer_model_reference_observation_link
- Purpose: end-to-end lineage from model artifact to exact external references.
- Key fields:
  - id, modelVersionId, observationId
  - usageType (train, validate, calibrate)
  - weight, linkedAt

### Constraints and Indexing

- Unique constraints:
  - Model uniqueness by (scopeType, scopeId, targetType, trainingWindowEnd).
  - Risk dedupe by (scopeType, scopeId, flagType, computedAtDate).
  - Run key uniqueness for idempotent execution.
  - Lineage uniqueness by (modelVersionId, observationId, usageType).
- Checks:
  - Non-negative sample counts and bounded percentages.
  - Valid interval ordering: lower <= point <= upper.
- Indexes:
  - Time and scope indexes on run and risk tables.
  - Approval-state and target-type indexes for quick retrieval.
  - Reverse lineage indexes on observationId and modelVersionId.
- Eligibility invariant:
  - Generated column or DB view for isEligibleForUse where
    approvalState = approved and approvalExpiresAt > now().

### Data Lineage Contract

Every risk flag must be traceable to:

1. aquifer_risk_flag.runId
2. run to aquifer_linear_regression_model via modelVersionId
3. model to external observations via
   aquifer_model_reference_observation_link
4. linked observations in aquifer_external_reference_observation

Required operational behavior:

- No policy-facing risk flag is published if lineage chain is incomplete.
- API must expose lineage references for regulator-facing audit endpoints.
- Lineage rows are immutable after model approval.

Partial lineage failure policy (mandatory):

- Publishing is district-granular, not all-or-nothing.
- Districts with complete lineage can publish policy-facing risk outputs.
- Districts with incomplete lineage are emitted as lineage_incomplete with no
  policy-facing risk publication.
- Run summaries include both published and lineage-blocked district counts.

## Forecast and Uncertainty Methodology

### Forecasting Approach

- Model family: linear regression (target-specific).
- Targets:
  - Aquifer level trajectory.
  - Extraction minus safe-yield trajectory.
- Forecast points: yearly projections for 5, 10, 25 years.

### Uncertainty Requirements

- Every forecast must include:
  - Point estimate
  - 80% prediction interval
  - 95% prediction interval
- If interval quality cannot be trusted, output must be downgraded and marked.
- UI and API must never show point estimates without uncertainty metadata.

### Uncertainty Method Policy (V1)

- Primary method:
  - Closed-form linear regression prediction intervals (80% and 95%).
- Calibration method:
  - Rolling backtest calibration verifies empirical coverage.
- Fallback trigger:
  - If empirical coverage falls outside acceptance bands for two consecutive
    calibration windows, switch to bootstrap intervals until issue resolution.
- Horizon caution policy:
  - 25-year outputs require explicit high-uncertainty annotation and confidence
    downgrade when interval width breaches policy threshold.

Complexity guardrails (mandatory):

- MAX_BOOTSTRAP_ITERATIONS policy constant.
- MAX_BOOTSTRAP_SAMPLE_SIZE policy constant.
- Estimator must fail fast to degraded mode when either guardrail is exceeded.

Method rationale and trade-offs must be included in scientific validation
artifacts before governance sign-off.

### Physical Plausibility Rulebook (V0)

The following v0 rules are mandatory implementation blockers for Phase 2.
Values below are conservative draft defaults requiring hydrogeology approval.

1. Maximum annual recovery-rate rule
- Reject forecast steps implying recovery > MAX_RECOVERY_M_PER_YEAR.
- Draft default: MAX_RECOVERY_M_PER_YEAR = 0.20.

2. Maximum annual depletion-rate rule
- Reject forecast steps implying depletion > MAX_DEPLETION_M_PER_YEAR unless
  explicitly tagged as exceptional scenario with signed rationale.
- Draft default: MAX_DEPLETION_M_PER_YEAR = 1.50.

3. Physical floor rule
- Reject projections crossing district physical floor depth PHYSICAL_FLOOR_DEPTH_M.
- If crossed at year N, projections beyond year N are withheld and marked as
  non-projectable.

4. Recharge-extraction consistency rule
- Reject scenarios where implied recharge required to sustain projected level
  exceeds MAX_IMPL_RECHARGE_M3_PER_YEAR.

5. Boundary continuity rule
- Reject abrupt discontinuities where year-over-year level delta magnitude
  exceeds MAX_YOY_DELTA_M without exogenous event annotation.

Rule governance:

- Rules are versioned using plausibilityPolicyVersion.
- Every run persists the policy version used.
- Policy changes require Hydrogeology SME approval and changelog.
- Bootstrap complexity constants are approved in the same policy package by
  Data Science and Platform owners.

## SQ-13 Risk Flag Policy

### Inputs

- Forecast points and uncertainty bands per horizon.
- District thresholds (warningThresholdPct and criticalThresholdPct).
- Safe-yield context and extraction trajectory.

### Outputs

- SQ13_5YR, SQ13_10YR, SQ13_25YR risk levels.
- SQ13_COMPOSITE as maximum severity across three horizons.
- Reason payload fields:
  - thresholdCrossing
  - yearsToCritical
  - intervalBreachProbabilityBand
  - dataQualityConfidenceBand

## API Contract Plan

### tRPC Procedures (Forecast Router)

1. forecast.getDistrictAquiferForecast
- Input: districtId, optional asOf.
- Output:
  - dual targets
  - 5, 10, 25-year points and intervals
  - per-horizon flags and composite
  - model quality and data quality diagnostics

2. forecast.getDistrictWellBreakdown
- Input: districtId, paging, sort, filters.
- Output: well-level forecast summaries and risk ordering.

3. forecast.listRiskFlags
- Input: districtId optional, horizon optional, severity optional, paging.
- Output: paged risk artifacts with reasons and model references.

4. forecast.triggerRecompute
- Input: scope and optional runKey.
- Access: admin and operator only.

### Cron Endpoint

- Route: /api/cron/aquifer-forecast
- Frequency: daily.
- Security: cron secret validation.
- Runtime behavior:
  - deterministic runKey
  - replay-safe result return
  - conflict handling for concurrent run key
  - stale-run reclamation policy

## Validation Framework

### A. Software Validation

- Unit tests:
  - regression math
  - interval construction and ordering
  - SQ-13 mapping boundaries
  - composite severity reduction
  - plausibility rules
- Integration tests:
  - DB persistence and retrieval
  - ABAC behavior by district and well scope
  - API schema and response completeness
  - cron idempotency behavior

### B. Scientific Validation

- Backtesting on held-out internal periods.
- Benchmarking against external observations from CEDARE and RIGW.
- Horizon-specific error and drift analysis.
- Interval calibration with empirical coverage checks.

### C. Governance Validation (Release Gate)

- Required approvers:
  - Hydrogeology SME
  - Data Science Lead
  - Policy and Product Owner
- Required artifacts:
  - methodology report
  - assumptions and limitations report
  - calibration and benchmark report
  - risk communication template

## Model Approval Workflow and Expiry Policy

### Approval States

- pending_review
- approved
- rejected
- expired
- superseded

### State Transition Authority

- Data Science Lead can move pending_review to approved or rejected.
- Hydrogeology SME co-approval is required for approved transition.
- Policy and Product Owner gives final policy-facing release authorization.
- System auto-transitions approved to expired at approvalExpiresAt.

### Operational Behavior on Expiry

- Daily cron must only use currently approved, non-expired models.
- If no eligible model exists:
  - run status becomes blocked_no_approved_model
  - policy-facing flags are not refreshed
  - last approved outputs remain visible with stale marker
  - paging alert is emitted to on-call and model approvers
- On-demand recompute can create pending_review artifacts but cannot publish
  policy-facing risk updates before approval.

### Approval SLA and Expiry Defaults (Draft)

- Approval decision SLA: <= 2 business days after model generation.
- Default approval validity period: 90 days.
- Mandatory revalidation before expiry or after major distribution shift.

## Acceptance Criteria (Proposed for Review)

| Category | 5-Year | 10-Year | 25-Year |
|---|---:|---:|---:|
| Point forecast bias threshold | <= 5% | <= 8% | <= 12% |
| 95% interval empirical coverage | 92%-98% | 90%-98% | 88%-98% |
| Data completeness minimum | >= 90% | >= 85% | >= 80% |
| Outlier ratio maximum | <= 5% | <= 7% | <= 10% |
| Plausibility violations allowed | 0 | 0 | 0 |

These values are placeholders and must be approved by hydrogeology and policy
stakeholders before release.

## Sequencing and Delivery Plan

1. Phase 0: Safety case and governance gates
2. Phase 1: Data contracts and external reference ingestion
3. Phase 2: Forecast plus uncertainty plus plausibility engine
4. Phase 3: Performance and reliability hardening
5. Phase 4: Persistence and auditability
6. Phase 5: API integration and ABAC enforcement
7. Phase 6: Cronization and operational idempotency
8. Phase 7: Validation and sign-off
9. Phase 8: Shadow mode, pilot, and progressive rollout

Performance hardening is intentionally before cronization to avoid debugging
concurrency and memory issues under scheduler automation.

Concurrent district processing model (mandatory):

- Default mode: parallel district processing with semaphore limit
  MAX_DISTRICT_CONCURRENCY.
- Each district execution has hard timeout DISTRICT_TIMEOUT_MS.
- On timeout, district returns degraded result while others continue.
- Sequential mode is fallback-only and must emit warning telemetry.

## Performance and SLO Targets

The following initial SLO targets are mandatory pass-fail criteria for Phase 3
load testing.

| SLO Dimension | Initial Target | Measurement Window | Owner |
|---|---|---|---|
| End-to-end daily run completion (all districts) | P95 <= 25 min, P99 <= 35 min | rolling 14 days | Platform |
| District-level forecast compute latency | P95 <= 90 sec per district | rolling 14 days | Platform |
| Worker memory ceiling | P99 RSS <= 1.5 GB per worker | rolling 14 days | Platform |
| Freshness SLA for policy dashboard | 99% of days updated by 06:00 local time | monthly | Platform + Product |
| Failed-run rate | <= 1.0% daily scheduled runs | rolling 30 days | Platform |
| Blocked-no-approved-model incidents | 0 unresolved beyond 24h | monthly | DS + Hydro + Product |

SLO governance:

- Targets can be tightened after first production quarter.
- Any target relaxation requires architecture review approval.
- Phase 3 is incomplete until all targets pass on representative load data.

Training reuse policy (mandatory for runtime efficiency):

- Skip retraining when all conditions hold:
  - last approved model trainingWindowEnd within MAX_MODEL_STALENESS_DAYS
  - data completeness not degraded beyond threshold
  - no drift alert requiring forced retraining
- In skip path, reuse approved model for projection and risk evaluation.

## Security, Privacy, and Access Control

- ABAC enforcement for district and well data scopes.
- Role-based execution for recompute endpoints.
- Secure cron secret handling and rotation policy.
- Immutable audit trails for model approval and run triggers.
- No external data ingestion path without provenance metadata.

## Observability and Operations

Required telemetry dimensions:

- runId, runKey, triggerType, scopeType, scopeCount
- targetType, horizon, durationMs
- qualityGateStatus, intervalHealth, plausibilityStatus
- failureClass, retryAction, modelVersion

Operational controls:

- Kill switch for scheduled execution.
- Rollback to last approved model version.
- Degraded-mode response when quality gates fail.
- Alerting for stale forecasts, failed approvals, and interval drift.

## Rollout Strategy

1. Shadow mode
- Run daily and publish diagnostics internally only.
- Compare to external observations and monitor calibration.

2. District pilot
- Enable selected districts under manual review cadence.
- Track false-risk and under-risk rates before expansion.

3. Progressive rollout
- Expand district coverage with rollback checkpoints.
- Require maintained calibration and operational SLOs.

## Deliverables Checklist

- Schema migrations and indexed persistence entities.
- Forecast engine module with uncertainty and plausibility checks.
- Forecast APIs and cron endpoint with idempotency.
- Validation suite (software + scientific).
- Governance sign-off package templates.
- Runbook for operations and incident response.
- Dashboard updates for uncertainty-first communication.

## Risks and Mitigations

1. Risk: Long-horizon uncertainty too wide for actionable guidance.
- Mitigation: confidence communication policy and scenario labeling.

2. Risk: External benchmark data latency or quality gaps.
- Mitigation: source-quality scoring and strict provenance gates.

3. Risk: Drift after environmental or extraction regime changes.
- Mitigation: periodic retraining, drift monitoring, and approval expiry.

4. Risk: Policy misuse of point estimates.
- Mitigation: API and UI contracts require intervals and confidence metadata.

## Open Decisions Requiring Stakeholder Input

- Final quantitative acceptance thresholds by horizon.
- Final numeric values for plausibility v0 constants.
- Retraining cadence stratified by district data quality tier.
- Formal owner for external data quality SLA management.

## Pre-Phase-2 Blockers (Must Be Resolved)

1. Plausibility v0 constants approved by Hydrogeology SME.
2. Uncertainty method sign-off completed (closed-form plus bootstrap fallback).
3. Initial SLO table approved by Platform and Product owners.
4. Model approval workflow ownership and escalation rota confirmed.
5. Lineage contract implementation accepted by governance reviewers.
6. DataSourceAdapter interface and adapter boundaries approved.
7. Concurrent district execution model and timeout policy approved.
8. Bootstrap complexity guardrail constants approved.
9. plausibilityPolicyVersion persistence in risk artifacts approved.

## Review Meeting Agenda (Recommended)

1. Confirm V1 scope and non-goals.
2. Approve safety case and release gate model.
3. Approve external validation methodology.
4. Approve uncertainty communication standard.
5. Confirm sequencing, staffing, and target delivery dates.
