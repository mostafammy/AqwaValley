---
post_title: "AqwaValley Report Generation and Export Engine PRD"
author1: "AqwaValley Engineering"
post_slug: "aqwavalley-report-generation-export-engine-prd"
microsoft_alias: "aqwavalley"
featured_image: "https://example.com/aqwavalley-report-engine.jpg"
categories:
  - Engineering
  - Architecture
  - Data Platform
tags:
  - reporting
  - export
  - cqrs
  - performance
  - security
ai_note: "AI-assisted draft, reviewed by engineering"
summary: "Comprehensive production-grade PRD and implementation plan dedicated to the Report Generation and Export Engine, including CQRS read architecture, async jobs, export strategies, security controls, and rollout gates."
post_date: "2026-04-01"
---

## Document Control

- Product: AqwaValley Governance Platform
- Capability: Report Generation and Export Engine
- Version: 1.0
- Status: Draft for product, security, and platform sign-off
- Owner: Data Platform and Governance Engineering
- Last Updated: 2026-04-01

## Executive Summary

The Report Generation and Export Engine is a dedicated bounded context that converts operational user and governance data into official, auditable, and high-performance report artifacts.

This plan defines a world-class delivery model that is:

- Scalable through CQRS read models and precomputation
- Reliable through asynchronous job orchestration
- Secure through strict RBAC plus scope and data masking
- Maintainable through SOLID boundaries and strategy-based extensibility
- Procurement-ready through traceability, deterministic outputs, and compliance controls

Reports must be reproducible at any point in time using the same inputs, snapshot ID, template version, and policy configuration.

## Problem Statement

Directly generating reports from transactional tables produces latency spikes, unstable performance under load, and weak operational guarantees. Governance workflows require consistent and auditable outputs that cannot depend on ad hoc heavy queries.

Current risk areas this plan addresses:

- Heavy report reads contend with OLTP workflows
- Synchronous generation causes request timeouts and poor UX
- Report-level authorization and auditability are incomplete
- Multi-format export strategy is not standardized

## Vision, Goals, and Non-Goals

### Vision

Deliver a government-grade reporting system that provides trusted insights and official exports without compromising platform performance.

### Goals

1. Provide a complete report lifecycle from request to delivery.
2. Keep report generation asynchronous, deterministic, and observable.
3. Separate write and read concerns with CQRS.
4. Deliver official PDF plus analytical CSV and Excel exports.
5. Enforce strict authorization, masking, and immutable audit trails.
6. Support growth in report volume and user concurrency.
7. Ensure deterministic and reproducible report outputs across time and environments.

### Non-Goals

1. Rebuilding all existing analytics logic in phase 1.
2. Replacing existing authentication provider.
3. Implementing custom BI tooling beyond required dashboards.

## Report Scope and Catalog

### Report Types

All report requests must declare a parameter contract:

- parameter schema version
- time range
- scope (district, farm, user)
- granularity (daily, weekly, monthly)
- template version
- policy version

1. User Activity Report

- Login frequency by period
- Role assignment and revocation history
- Action timeline by actor and district

2. District Governance Report

- User population per district
- Role distribution and trend
- Active versus inactive account ratios

3. Compliance Report

- Unauthorized access attempts
- Policy violation incidents
- Token misuse and repeated invalid access attempts

4. Audit Trail Export

- Immutable activity and decision timeline
- Evidence-focused sections for oversight reviews

5. Monthly Government Governance Pack

- Branded PDF summary
- CSV and Excel data annexes
- Signature-ready metadata envelope
- Frozen snapshot ID for reproducible reruns and audits

## Functional Requirements

### FR-1 Report Requests

- Authorized users can request reports with scope filters and time windows.
- Requests are validated for scope and compliance policy before queueing.
- Request submission returns a job reference immediately.

### FR-2 Asynchronous Generation

- All standard reports are generated asynchronously.
- Worker pipeline supports retries and dead-letter processing.
- Job state transitions are persisted and queryable.
- Duplicate report requests with identical normalized parameters and snapshot ID must return the same active job or reusable cached artifact when policy allows.
- Users and administrators can re-run a report using original parameters and the original snapshot ID.

### FR-3 Export Formats

- System supports PDF, CSV, and Excel export strategies.
- Template version used for generation is stored with artifact metadata.
- Export output integrity hash is stored for verification.
- System must support explicit artifact generation mode:
  - strict mode: all requested artifacts must succeed or the job fails
  - partial mode: successful artifacts are published and failed artifacts remain retryable

### FR-4 Delivery and Retrieval

- Completed reports are available via secure short-lived URLs.
- Delivery events are auditable, including download and access denial attempts.
- Failed reports provide actionable failure diagnostics.

### FR-5 Report Governance and Audit

- Every generate, view, download, and share event is audit logged.
- Sensitive fields are masked based on role and jurisdiction.
- Retention and deletion policies are enforced per report category.

## Non-Functional Requirements

### NFR-1 Scalability

- Support at least 20x baseline report request volume without redesign.
- Isolate report workload from transactional write path.
- Scale workers horizontally based on queue depth.

### NFR-2 Performance

- P95 request acknowledgment less than or equal to 500 ms.
- P95 standard monthly report completion less than or equal to 30 seconds.
- P95 artifact download less than or equal to 2 seconds.

### NFR-3 Data Freshness and Correctness

- Reports reflect data up to the last successful refresh watermark.
- Each generated report displays freshness timestamp and snapshot ID.
- Report generation must fail fast if cross-source watermarks are inconsistent.

### NFR-4 Reliability

- At-least-once job processing with idempotent artifact generation.
- Automatic retries with bounded exponential backoff.
- Dead-letter queue handling with replay controls.

### NFR-5 Determinism

- Same normalized inputs, snapshot ID, template version, and policy version must produce identical output hash.
- Determinism must be validated by golden-dataset tests in CI.

### NFR-6 Security

- RBAC plus district and farm scope checks on every request and download.
- Signed URL artifact access with expiry.
- Encryption at rest and in transit for report artifacts.

### NFR-7 Cost Efficiency

- Track compute and storage cost per report and per format.
- Define retention tiers to balance compliance and storage spend.
- Enforce caching policy with freshness-safe invalidation.
- Cache keys must include normalized parameters, snapshot ID, template version, and policy version.

### NFR-8 Maintainability and Type Safety

- Strict TypeScript and Zod schemas for all API boundaries.
- Versioned DTO contracts for backward compatibility.
- Narrow interfaces and composable services aligned with SOLID.

## Bounded Context and Architecture

### Reporting Engine Bounded Context

Core responsibilities:

- Report request intake and validation
- Read model aggregation and precomputation
- Asynchronous rendering and export
- Artifact storage and secure retrieval
- Report-level auditing and compliance enforcement

### Target Architecture

```text
[API Layer]
    ↓
[Reporting Orchestrator]
    ↓
[Aggregation Services]
    ↓
[Read Models / Materialized Views]
    ↓
[Export Engine (PDF/CSV/Excel)]
    ↓
[Artifact Storage + Notification]
```

### CQRS Strategy

Write side:

- Existing users and auth transactional workflows remain optimized for correctness and integrity.

Read side:

- Reporting engine consumes denormalized projections and materialized views for predictable performance.
- Read model refresh uses hybrid mode:
  - time-based refresh windows
  - event-triggered incremental updates for high-value changes

Benefits:

- Decoupled scaling strategies
- Lower OLTP contention
- Stable report latency under concurrent load

Trade-off:

- Increased architectural complexity and additional data refresh orchestration

## Data and Read Model Design

### Core Reporting Tables

- report_definition
- report_job
- report_artifact
- report_delivery_event
- report_audit_log
- report_access_policy

### Suggested Read Models

- user_activity_summary_daily
- district_governance_summary_daily
- compliance_incident_summary_daily
- audit_event_rollup_daily

### Materialized View and Refresh Policy

- Incremental refresh every 5 to 15 minutes for operational reports
- Full daily compaction for monthly governance packs
- Refresh failures trigger alerts and fallback to previous successful snapshot

### Snapshot and Consistency Strategy

- Each report job binds to a consistent snapshot ID across all required projections.
- Snapshot ID and refresh watermark set are persisted in report metadata.
- Rendering starts only after consistency validation passes.
- Snapshot is defined as a consistent watermark set across all projections.
- Optional physical snapshotting (versioned tables or partitions) may be enabled for high-critical reports.

### Backfill and Replay Strategy

- Backfill jobs replay missed refresh windows after outages.
- Replay is idempotent and generates auditable correction events.
- Backfill completion updates freshness watermark and unblocks pending report jobs.

## Service and Pattern Design

### Core Interfaces

```ts
interface ReportGenerator {
  generate(data: ReportData): Promise<Buffer>;
}

interface ExportStrategy {
  export(input: {
    data: ReportData;
    templateVersion: string;
    metadata: ReportMetadata;
  }): Promise<ExportResult>;
}

interface ReportJobQueue {
  enqueue(job: ReportJobRequest): Promise<JobId>;
  claim(batchSize: number): Promise<ReportJobRequest[]>;
  complete(jobId: JobId, result: ExportResult): Promise<void>;
  fail(jobId: JobId, reason: string): Promise<void>;
}
```

### Component Pattern Mapping

| Component             | Responsibility                    | Pattern       | SOLID Focus |
| --------------------- | --------------------------------- | ------------- | ----------- |
| ReportingRouter       | Request and query contracts       | Facade        | ISP, DIP    |
| ReportingOrchestrator | Lifecycle coordination            | Mediator      | SRP, OCP    |
| AggregationService    | Build and refresh read models     | Pipeline      | SRP         |
| ReportReadRepository  | Optimized projection access       | Repository    | DIP         |
| ReportJobEnqueuer     | Async job submission              | Producer      | SRP         |
| ReportWorker          | Artifact generation               | Worker        | SRP         |
| ExportEngine          | Format strategy dispatch          | Strategy      | OCP, DIP    |
| ReportPolicyGuard     | Scope and policy checks           | Policy Object | SRP, LSP    |
| ReportAuditDecorator  | Audit wrapper for core operations | Decorator     | SRP, OCP    |

### Export Determinism Constraints

Export strategies must enforce deterministic rendering:

- stable ordering for all collections and rows
- fixed locale and timezone at render time
- deterministic numeric and date formatting rules
- exclusion of runtime-generated timestamps unless explicitly provided in input metadata
- deterministic document metadata fields for PDF and Excel outputs

## Security and Compliance Controls

### Access Control

- Enforce role plus scope checks at request and retrieval boundaries.
- Validate district and farm ownership context in policy guard.
- Deny by default with explicit policy grants.
- Enforce tenant isolation at query, cache, and artifact retrieval layers.

### Data Protection

- Role-based masking for personally sensitive fields.
- Signed URLs with short TTL for artifact downloads.
- Full artifact encryption and secure deletion process.
- Field-level masking decisions are logged with reason codes and policy references.

### Audit and Evidence

- Immutable event log for generation, access, and delivery.
- Output integrity hashing for each artifact.
- Provenance record: source snapshot, template version, policy version.
- Masking rules version is persisted with each generated artifact.

## Performance and Capacity Plan

### Performance Strategy

- Pre-aggregation and materialized view usage by default.
- Redis caching for repeated report parameter sets.
- Batch worker execution with controlled concurrency.
- Pagination and bounded time windows for detailed drill-down.

### Large Report Handling

- Support streaming exports for very large CSV and Excel outputs.
- Support chunked generation and chunked upload for large artifacts.
- Enforce memory limits per worker and spill-to-disk strategy where needed.
- Prefer asynchronous download packaging for artifacts above configured size thresholds.

### Capacity Strategy

- Auto-scale workers based on queue depth and processing latency.
- Isolate report workers from user-facing API runtime pools.
- Define queue backpressure thresholds and degrade gracefully.
- Prevent queue starvation via priority queues and separated worker lanes for small and large jobs.

## Observability, Alerts, and SRE Readiness

### Logs

- Structured logs with reportJobId and correlationId.
- Phase-level timing logs from request to artifact storage.

### Metrics

- report_requests_total
- report_jobs_in_queue
- report_generation_latency_ms
- report_export_failures_total
- report_downloads_total
- report_authorization_denials_total
- reports_generated_by_type
- avg_report_size_mb
- report_cache_hit_ratio

### Alerts

- Queue backlog above threshold
- P95 generation latency breach
- Export error rate anomaly
- Materialized view refresh failures
- Repeated denied access spikes

### SLO Error Budget Policy

- Define monthly error budgets aligned with report generation and retrieval SLOs.
- Burn-rate alerts trigger rollout freeze and reliability-focused remediation.
- Repeated error budget exhaustion requires architecture review before feature expansion.

## Explainable Governance Extension

### Objective

Provide AI-assisted governance explanations as an advisory layer to improve decision transparency.

### Rules

- Explanations are never policy authority.
- Every explanation must reference concrete source events.
- Include confidence and provenance metadata.
- Persist explanation records for auditability.
- Non-binding disclaimer is mandatory on every explanation output.
- Explanation model version must be persisted for traceability.

## Delivery Plan (8 Weeks)

Parallelization note:

- Weeks 3 to 5 can partially overlap: queue lifecycle hardening, export strategy implementation, and security guard scaffolding can proceed in parallel once API and metadata contracts are frozen.

### Phase 1: Foundation and Contracts (Week 1)

1. Finalize report catalog and acceptance criteria.
2. Define schemas for report jobs and artifacts.
3. Publish API contracts and DTO versions.

### Phase 2: CQRS Read Models (Week 2)

1. Implement daily summary tables and materialized views.
2. Add refresh jobs and monitoring hooks.
3. Validate query plans and indexes.

### Phase 3: Async Engine and Worker (Week 3-4)

1. Build queue abstraction and job lifecycle state machine.
2. Implement report worker with retries and dead-letter path.
3. Add artifact storage and retrieval metadata.

### Phase 4: Export Strategies (Week 5)

1. Implement PDF export strategy.
2. Implement CSV export strategy.
3. Implement Excel export strategy.
4. Add deterministic template versioning.

### Phase 5: Security and Compliance (Week 6)

1. Add policy guard for report scope and masking.
2. Add report-level audit decorators.
3. Add signed URL and retention enforcement.

### Phase 6: UX and Dashboards (Week 7)

1. Add report center UI for request, status, and download.
2. Add governance trend charts and heatmaps.
3. Add one-click monthly governance pack action.

### Phase 7: Hardening and Rollout (Week 8)

1. Load, resilience, and security testing.
2. UAT with procurement-style scenarios.
3. Canary rollout and SLO validation.

## Implementation Backlog

| ID     | Work Item                           | Priority | Owner                | Exit Criteria                                                 |
| ------ | ----------------------------------- | -------- | -------------------- | ------------------------------------------------------------- |
| RE-001 | Define report schemas and enums     | P0       | Backend              | Migrations and contracts approved                             |
| RE-002 | Build report job queue lifecycle    | P0       | Backend              | Reliable enqueue and worker claim cycle                       |
| RE-003 | Implement read model aggregations   | P0       | Data and Backend     | P95 query target met                                          |
| RE-004 | Implement PDF export strategy       | P0       | Backend              | Official template output validated                            |
| RE-005 | Implement CSV and Excel strategies  | P0       | Backend              | Multi-format export passes acceptance                         |
| RE-006 | Add policy guard and masking rules  | P0       | Security and Backend | Zero unauthorized scope leaks                                 |
| RE-007 | Add report audit logging            | P0       | Backend              | Full report event traceability                                |
| RE-008 | Build report center UI              | P1       | Frontend             | Request, status, download complete                            |
| RE-009 | Add one-click monthly report action | P1       | Frontend and Backend | Monthly pack generated successfully                           |
| RE-010 | Add explainable governance layer    | P2       | AI and Backend       | Evidence-linked explanations delivered                        |
| RE-011 | Implement snapshot binding system   | P0       | Data and Backend     | Every report includes validated snapshot ID and watermark set |
| RE-012 | Implement reporting cache layer     | P1       | Backend and Platform | Cache hit ratio and freshness-safe invalidation verified      |

## Testing and Quality Gates

### Unit Tests

- Lifecycle state transitions
- Export strategy formatting behavior
- Policy masking and authorization edge cases

### Integration Tests

- End-to-end job flow request to artifact
- Retry and dead-letter behavior
- Signed URL retrieval and expiry rules

### Non-Functional Tests

- Load tests for concurrent report jobs
- Chaos tests for worker and storage failures
- Security tests for scope bypass and data leakage

### Determinism Tests

- Golden dataset test: fixed snapshot and parameters must produce byte-identical artifacts and stable hashes.
- Replay test: rerunning with original snapshot and versions must reproduce original output hash.

### Release Gates

1. All P0 items complete
2. P95 SLOs met for generation and retrieval
3. Security review passes with no critical findings
4. UAT sign-off for top 4 reports

## Risks and Trade-Offs

| Decision            | Benefit                             | Cost                                     |
| ------------------- | ----------------------------------- | ---------------------------------------- |
| CQRS                | Scalable and isolated read workload | Added operational complexity             |
| Async generation    | Stable API performance              | Delayed completion UX                    |
| Pre-aggregation     | Predictable fast reporting          | Extra storage and refresh costs          |
| Multi-format export | Wider stakeholder usability         | More implementation and testing overhead |

### Additional Risks

| Risk                                      | Impact | Mitigation                                               |
| ----------------------------------------- | ------ | -------------------------------------------------------- |
| Data inconsistency across projections     | High   | Snapshot binding and mixed-watermark validation          |
| Snapshot drift across refresh windows     | High   | Snapshot ID enforcement with replay verification         |
| Cost explosion from exports and retention | Medium | Cost-per-report monitoring, retention tiers, and caching |

## Final Principal SWE Verdict

Current baseline can support a strong reporting foundation, but a dedicated reporting bounded context is required for world-class outcomes.

After this plan is implemented, AqwaValley gains:

- Government-grade reporting reliability
- Procurement-ready auditability and compliance posture
- High-performance, scalable exports across PDF, CSV, and Excel

## Immediate Next Actions

### Priority 0

- Approve report catalog and acceptance criteria
- Approve CQRS and async architecture
- Start schema plus queue implementation

### Priority 1

- Build export strategies and artifact security controls
- Implement report center UI and status tracking

### Priority 2

- Launch explainable governance and advanced visual previews

## Implementation Contract Appendix

This appendix defines non-negotiable implementation contracts so delivery teams can execute without ambiguity.

### A. Deterministic Export Checklist

Every export strategy implementation must satisfy all checks below before release.

| Check                    | Requirement                                                                | Validation Method                                |
| ------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------ |
| Input normalization      | Normalize parameter order, default values, and null handling before render | Unit test with equivalent parameter permutations |
| Stable ordering          | Sort all rows and nested collections with explicit sort keys               | Golden dataset byte comparison                   |
| Fixed locale/timezone    | Use UTC and fixed locale for number/date formatting                        | Snapshot tests across environments               |
| Deterministic formatting | Enforce fixed decimal precision, separators, and date formats              | Contract tests per format                        |
| Metadata stability       | PDF and Excel metadata fields must be deterministic and versioned          | Binary metadata inspection test                  |
| Timestamp control        | Exclude runtime-generated timestamps unless included in input metadata     | Output diff tests                                |
| Hash reproducibility     | Same normalized input and versions produce same output hash                | Replay test with hash equality assertion         |

Mandatory release gate:

- Golden dataset test suite must pass for PDF, CSV, and Excel with byte-identical outputs or format-approved canonical-hash equivalence.

### B. Snapshot Metadata Schema

The following schema is the minimum metadata payload persisted for every report job and artifact.

```json
{
  "snapshotId": "snap_2026-04-01T12:00:00Z_001",
  "snapshotType": "logical",
  "watermarks": {
    "user_activity_summary_daily": "2026-04-01T11:55:00Z",
    "district_governance_summary_daily": "2026-04-01T11:55:00Z",
    "compliance_incident_summary_daily": "2026-04-01T11:55:00Z",
    "audit_event_rollup_daily": "2026-04-01T11:55:00Z"
  },
  "templateVersion": "v1.3.0",
  "policyVersion": "policy-2026-03-15",
  "maskingRulesVersion": "mask-2026-03-20",
  "parameterSchemaVersion": "report-params-v2",
  "normalizedParametersHash": "sha256:...",
  "generatedAt": "2026-04-01T12:00:05Z",
  "generatorVersion": "report-worker-1.8.2"
}
```

Schema rules:

- `snapshotId` is required and immutable for reruns.
- `watermarks` must include all read models consumed by the report.
- `templateVersion`, `policyVersion`, and `maskingRulesVersion` are required for provenance.
- `normalizedParametersHash` is required for idempotency and cache keying.
- `snapshotType` allowed values: `logical`, `physical`.

### C. Large-File Thresholds and Worker Limits

Use the following operational thresholds as defaults. These can be tuned with capacity review but cannot be removed.

| Category                         | Threshold                                           | Required Behavior                                          |
| -------------------------------- | --------------------------------------------------- | ---------------------------------------------------------- |
| Inline artifact response         | less than or equal to 25 MB                         | Eligible for direct signed URL completion                  |
| Medium artifact                  | greater than 25 MB and less than or equal to 250 MB | Force async packaging and chunked upload                   |
| Large artifact                   | greater than 250 MB and less than or equal to 1 GB  | Streaming export required with chunk checkpointing         |
| Oversized artifact               | greater than 1 GB                                   | Reject by policy unless elevated admin override is present |
| Worker memory soft limit         | 1.5 GB                                              | Trigger streaming mode and spill-to-disk                   |
| Worker memory hard limit         | 2 GB                                                | Abort job safely, mark retryable failure                   |
| Max CSV rows per single artifact | 1,000,000 rows                                      | Use partitioned export or multi-part bundle                |
| Max XLSX rows per worksheet      | 1,048,576 rows                                      | Split across sheets or files                               |

Worker execution contracts:

- Chunk size default: 8 MB per upload part.
- Worker heartbeat interval: 15 seconds.
- Job lock timeout: 5 minutes with renewal.
- Retry backoff: 1 minute, 5 minutes, 15 minutes, 60 minutes, then dead-letter.
- Queue classing: small, standard, large to prevent starvation.

### D. Engineering Acceptance Criteria for Appendix Compliance

Implementation is considered compliant only when:

1. Deterministic export checklist is fully automated in CI.
2. Snapshot metadata schema is persisted for every generated artifact.
3. Large-file thresholds are enforced by policy guards and worker runtime.
4. Worker memory and retry controls are observable in dashboards and alerts.
