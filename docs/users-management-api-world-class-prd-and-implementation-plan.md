---
post_title: "AqwaValley Users Management API PRD and Implementation Plan"
author1: "AqwaValley Engineering"
post_slug: "aqwavalley-users-management-api-prd-implementation-plan"
microsoft_alias: "aqwavalley"
featured_image: "https://example.com/aqwavalley-users-management.jpg"
categories:
  - Engineering
  - Architecture
  - Backend
tags:
  - users-management
  - trpc
  - nextjs
  - drizzle
  - security
ai_note: "AI-assisted draft, reviewed by engineering"
summary: "Production-grade PRD and implementation plan for the Users Management API, including architecture, SOLID-aligned service design, scalability, reliability, security, and phased delivery."
post_date: "2026-04-01"
---

## Document Control

- Product: AqwaValley Governance Platform
- Feature: Users Management API and Admin Experience
- Version: 1.0
- Status: Draft for engineering and product sign-off
- Owner: Platform and Identity Engineering
- Last Updated: 2026-04-01

## Executive Summary

The Users Management API is the identity and access control backbone for district governance, farm operations, and compliance workflows.

This PRD and implementation plan defines how to elevate the current implementation to a world-class, production-grade capability with:

- Deterministic and auditable user lifecycle management
- Secure invitation and password reset pipelines
- Role and scope governance with strict authorization boundaries
- Operational reliability through background processing and scheduled jobs
- High maintainability through SOLID, strict type-safety, and clean boundaries
- Scalable architecture supporting growth in users, districts, and workflows

## Problem Statement

Current implementation quality is strong in core backend architecture but has important delivery gaps for production excellence:

- Cron scheduling is not configured in deployment
- Admin UX is partially implemented
- Test coverage is minimal for critical paths
- Observability and operational runbooks are incomplete

Without these capabilities, the system risks operational failures, weak supportability, and reduced confidence in procurement or governance reviews.

## Product Vision and Goals

### Vision

Provide a secure, auditable, and operationally resilient user management platform that enables trusted governance at scale.

### Goals

1. Deliver a complete user lifecycle from provisioning to deactivation.
2. Ensure every sensitive action is auditable and reproducible.
3. Enforce least privilege with district and farm scope correctness.
4. Maintain high reliability under failures and retries.
5. Keep performance predictable under expected growth.
6. Preserve developer velocity through strong architecture and type safety.

### Non-Goals

1. Replacing core authentication provider in this phase.
2. Building generic IAM for third-party tenant onboarding.
3. Introducing complex policy engines beyond current role plus scope model.

## Success Metrics and SLOs

### Product KPIs

- Invitation completion rate greater than or equal to 90% in 7 days
- Admin action success rate greater than or equal to 99.5%
- Time to provision a single user less than or equal to 2 seconds at P95
- Time to bulk provision 50 users less than or equal to 20 seconds at P95

### Reliability SLOs

- Users API availability greater than or equal to 99.9%
- Background email dispatch success greater than or equal to 99.5% before dead-letter
- Scheduled jobs execution success greater than or equal to 99.9%

### Security and Compliance Metrics

- 100% of sensitive mutations generate audit log records
- 100% of token-based flows enforce expiration and one-time use
- 0 unauthorized cross-district access incidents

## Personas and Core Use Cases

### Personas

- Platform Admin: provisions users, assigns roles, audits actions
- District Manager: manages district-scoped users and farm access
- Farm Owner and Farmer: profile and password self-service
- Auditor: read-only review of immutable action logs

### Primary Use Cases

1. Create and invite a user with optional farm scope.
2. Bulk provision users from CSV.
3. Validate invitation and set initial password.
4. Trigger and complete password reset flow.
5. Assign and revoke roles with immediate session invalidation.
6. Deactivate users safely with complete audit evidence.

## Functional Requirements

### FR-1 Identity Provisioning

- System shall provision auth user and domain profile atomically.
- System shall support idempotent create-and-invite operations.
- System shall return explicit result states for duplicate and pending scenarios.

### FR-2 Invitations and Tokens

- System shall issue cryptographically secure invitation tokens.
- System shall store only hashed tokens.
- System shall enforce one-time use and TTL expiration.
- System shall support resend and revoke operations.

### FR-3 Role and Scope Management

- System shall support role assignment and revocation.
- System shall support district and farm-level scope boundaries.
- System shall invalidate active sessions on privilege reductions.

### FR-4 Profile and Password Management

- Authenticated users shall read and update profile fields.
- Public reset flow shall be enumeration-safe.
- Reset and invitation token flows shall provide clear error states.

### FR-5 Admin Operations and Auditability

- System shall expose invitation management, user directory, and audit retrieval.
- Every sensitive mutation shall emit immutable audit records.
- Email send attempts shall be recorded with delivery metadata.

### FR-6 Background Processing and Scheduling

- System shall process outbox email events with retry and dead-letter controls.
- System shall run scheduled jobs for email dispatch and token cleanup.
- Jobs shall be idempotent and safe to retry.

## Non-Functional Requirements

### NFR-1 Scalability

- Support at least 10x current user and invitation volume without redesign.
- Isolate write-heavy workflows via asynchronous outbox processing.
- Use indexed queries for list and audit workflows.

### NFR-2 Maintainability

- Enforce strict boundaries between router, orchestrator, domain services, and infrastructure adapters.
- Keep classes single-purpose and composable.
- Maintain backward-compatible API contracts where possible.

### NFR-3 Performance

- Optimize list queries with pagination and proper indexes.
- Keep hot paths free of external blocking calls inside core transactions.
- Measure P50, P95, and P99 for provisioning and listing procedures.

### NFR-4 Type Safety

- Use end-to-end type-safe schemas with Zod and TypeScript strict mode.
- Avoid any and unsafe casts in service and API boundaries.
- Validate all external payloads at ingress boundaries.

### NFR-5 Security

- Enforce principle of least privilege for all procedures.
- Use secure password hashing and token handling standards.
- Apply request throttling and abuse protections for public endpoints.

### NFR-6 Observability

- Emit structured logs with request and correlation context.
- Track metrics for provisioning, invitation, and outbox workflows.
- Define alerts for dead-letter growth and elevated error rates.

## Current State Assessment

### Strengths

- High-quality orchestration and service decomposition
- Strong token security model with hashed storage and TTL
- Transactional outbox pattern for reliable email dispatch
- Audit-focused design across role and farm scope changes

### Gaps to Close

- Missing deployment cron configuration
- Incomplete admin pages for invitation and audit operations
- Missing comprehensive test suite
- Limited metrics and alerting coverage

## Target Architecture

### Layers

1. API Layer: tRPC routers, input validation, authorization guards
2. Application Layer: orchestrators and use-case services
3. Domain Layer: token validation, role invariants, lifecycle state rules
4. Infrastructure Layer: database repositories, auth adapter, email transport, scheduler

### 3.1 Introduce: Report Generation and Export Engine (Core System)

Add a new bounded context: Reporting Engine.

#### New Module: Reporting Engine

Responsibilities:

- Generate user activity reports
- Generate district-level governance reports
- Generate compliance reports
- Generate audit summaries
- Export as PDF for official documents
- Export as CSV for analysis
- Export as Excel for government workflows

### 3.2 Target Architecture Extension

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
```

### 3.3 Key Design Patterns (Google-Level)

#### 1. CQRS (Critical)

Split responsibilities explicitly:

- Write side: Users API (existing)
- Read side: Reporting Engine with optimized aggregated models

Rationale:

- Isolates transactional writes from heavy reporting reads
- Improves scalability and team ownership boundaries
- Enables independent optimization and indexing strategies

#### 2. Materialized Views and Precomputation

Avoid direct heavy scans such as querying raw audit logs for each report request.

Use precomputed read models such as:

- user_activity_summary_daily
- district_governance_summary_daily
- compliance_incident_summary_daily

Rationale:

- Faster and predictable report generation latency
- Better scalability under concurrent usage
- Reduced pressure on operational OLTP tables

#### 3. Async Report Jobs

Report generation must be asynchronous by default.

Flow:

1. User requests report generation.
2. API enqueues report job.
3. Worker generates report artifact.
4. Artifact stored in object storage.
5. User notified when ready.

Rationale:

- Prevents long-running API requests
- Improves reliability with retries and dead-letter handling
- Enables horizontal scaling of worker throughput

### Core Components and Design Patterns

| Component                    | Responsibility                             | Pattern                              | SOLID Focus |
| ---------------------------- | ------------------------------------------ | ------------------------------------ | ----------- |
| Users Router                 | API contracts and access checks            | Facade                               | ISP, DIP    |
| UserProvisioningOrchestrator | Coordinates create-and-invite workflow     | Mediator                             | SRP, OCP    |
| AuthUserCreator              | Auth provider abstraction                  | Adapter                              | DIP         |
| InvitationIssuer             | Token issue and lookup                     | Repository                           | SRP         |
| RoleAssigner                 | Role mutation plus audit                   | Command                              | SRP, OCP    |
| FarmScopeAssigner            | Farm linkage plus audit                    | Command                              | SRP         |
| SessionInvalidator           | Session revocation on role change          | Observer                             | OCP         |
| OutboxEnqueuer               | Durable async events                       | Producer                             | DIP         |
| DispatchEmails Job           | Retry and dead-letter execution            | Worker                               | SRP         |
| Audit Log Service            | Immutable evidence trail                   | Event Sourcing style append-only log | SRP, LSP    |
| ReportingOrchestrator        | Coordinates report requests and jobs       | Mediator                             | SRP, OCP    |
| AggregationService           | Builds and refreshes reporting read models | Pipeline                             | SRP, DIP    |
| ReportReadModelRepository    | Query optimized report projections         | Repository                           | ISP, DIP    |
| ReportJobEnqueuer            | Enqueue report generation jobs             | Producer                             | SRP, DIP    |
| ReportWorker                 | Generates artifacts asynchronously         | Worker                               | SRP         |
| ExportEngine                 | Strategy-based format rendering            | Strategy                             | OCP, DIP    |
| ReportAccessPolicy           | RBAC plus scope enforcement for reports    | Policy Object                        | SRP, LSP    |
| ReportAuditLogger            | Audit report generation and downloads      | Decorator                            | SRP, OCP    |

### Data Contracts and Type Safety

- Use Zod schemas for all external requests and responses.
- Use discriminated unions for provisioning outcomes.
- Use typed repository return models with no implicit null assumptions.
- Keep token and invitation state transitions encoded as enums and state guards.
- Use discriminated unions for report lifecycle states such as queued, processing, ready, failed, and expired.
- Keep report DTOs versioned and backward-compatible to protect export consumers.

### 3.4 Report Catalog

#### User Activity Report

- Login frequency
- Role changes
- Actions timeline

#### District Governance Report

- Users per district
- Role distribution
- Active versus inactive users

#### Compliance Report

- Unauthorized access attempts
- Policy violation events
- Token misuse attempts

#### Audit Trail Export

- Immutable audit log timeline
- Compliance-ready PDF output with structured sections

### 3.5 Export Engine Design

Interfaces (TypeScript):

```ts
interface ReportGenerator {
  generate(data: ReportData): Promise<Buffer>;
}

interface ExportStrategy {
  export(report: Buffer): Promise<ExportResult>;
}
```

Implementations:

- PDF strategy for official and printable reports
- CSV strategy for analytics and spreadsheet ingestion
- Excel strategy for government office workflows

Design notes:

- Use strategy pattern for format extensibility without modifying orchestrator logic
- Use template versioning for deterministic, reproducible report outputs
- Apply report auditing as a decorator around export strategies

### 3.6 Performance Strategy

Problem:

- Reports are read-heavy and query-intensive.

Solution:

- Pre-aggregation tables and materialized views
- Background job generation and batching
- Redis caching for frequently requested parameter sets
- Bounded report windows and paginated drill-down for large timelines

Target performance objectives:

- P95 report request acknowledgment less than or equal to 500 ms
- P95 report generation completion less than or equal to 30 seconds for standard monthly scope
- P95 report download response less than or equal to 2 seconds for ready artifacts

### 3.7 Security Upgrade

Reporting workflows must:

- Enforce RBAC plus scope boundaries for each report request and download
- Mask sensitive data based on role policy and jurisdiction
- Produce immutable audit events for generate, view, download, and share actions
- Store artifacts with signed URL access and explicit expiration
- Apply retention and secure deletion policies aligned to compliance requirements

## Security Architecture

### Authentication and Authorization

- Authentication handled by better-auth session model.
- Authorization handled by role plus scope checks in router middleware.
- Sensitive admin procedures restricted to admin and approved roles only.

### Sensitive Data and Tokens

- Never persist raw invitation or reset tokens.
- Enforce TTL and one-time use in domain service.
- Use bcrypt hashing for passwords and SHA-256 for token hashing.

### Abuse and Threat Controls

- Rate limit public reset requests by IP and user identifier.
- Keep reset responses enumeration-safe.
- Add anomaly detection for repeated failed token validations.

## Scalability and Performance Plan

### Query and Data Strategy

- Add or validate indexes for invitation list, audit log, and role assignments.
- Keep all list endpoints paginated and filterable.
- Move heavy email operations to asynchronous outbox workers.

### Runtime Strategy

- Add distributed rate limiting abstraction with Redis option.
- Preserve deterministic transaction boundaries for critical writes.
- Apply connection pooling and timeout budgets for DB and SMTP operations.
- Separate reporting read workload from transactional workload using CQRS read models.
- Schedule materialized view refresh windows and incremental aggregation jobs.
- Keep report generation asynchronous with queue-depth monitoring and auto-scaling workers.

## Observability and Operations

### Logs

- Structured logs for every mutation and workflow stage.
- Correlation ID propagation from API request to outbox execution.

### Metrics

- Provisioning latency histograms
- Invitation issuance and acceptance counters
- Outbox retry and dead-letter counters
- Role assignment and revocation counters
- Report queue depth and worker throughput
- Report generation latency by type and scope
- Export failures by format (PDF, CSV, Excel)
- Report download volume and authorization failure counters

### Alerts

- Dead-letter queue growth above threshold
- Error rate spike in create-and-invite workflow
- Scheduler execution misses for cron jobs
- Report queue backlog above service threshold
- Materialized view refresh failures
- Repeated report authorization denials indicating possible abuse

## Judge-Winning Enhancements

### 4.1 Explainable Governance

Add an AI-assisted explanation layer to accompany key governance outcomes.

Example explanation output:

- User was deactivated due to repeated failed login attempts.
- Policy threshold breach detected in district-level access pattern.
- Administrative decision justified by role and compliance rules.

Engineering constraints:

- Explanation layer is advisory and does not replace policy engine decisions.
- Persist source evidence references for every generated explanation.
- Add clear confidence and provenance fields to avoid opaque AI output.

### 4.2 Visual Dashboards

Enhance admin experience with:

- Governance trend charts
- User activity heatmaps
- Role-change and deactivation timelines

Design objective:

- Enable rapid anomaly detection and decision support before export generation.

### 4.3 One-Click Government Report

Add a single action for monthly governance package generation.

Output:

- Branded PDF for official review
- CSV or Excel companion data for analysis
- Signature-ready metadata envelope for future digital signing integration

Outcome objective:

- Demonstrate procurement-ready operational maturity and real administrative utility.

## Trade-Offs and Engineering Decisions

| Decision                | Benefit                                | Cost                                        |
| ----------------------- | -------------------------------------- | ------------------------------------------- |
| CQRS                    | Read scalability and isolation         | Additional architectural complexity         |
| Async reports           | Better API performance and reliability | Delayed UX completion feedback              |
| Pre-aggregation         | Fast and predictable query latency     | Increased storage and refresh orchestration |
| PDF generation pipeline | Professional and official outputs      | Rendering and infrastructure overhead       |

## Final Verdict (Principal SWE Judgment)

Current state:

- Strong backend system foundations
- Not yet a complete winning product for procurement-grade reporting

After recommended changes:

- Government-grade reporting platform
- Competition-level demonstrable system maturity
- Procurement-ready, auditable, and scalable solution

## Actionable Next Steps

### Priority 0 (Must Do)

- Add Reporting Engine section and architecture to PRD and implementation planning
- Finalize report catalog and acceptance criteria for 4 to 6 report types
- Implement asynchronous report job architecture and worker runtime

### Priority 1

- Introduce CQRS read models and aggregation pipelines
- Deliver export formats: PDF, CSV, and Excel
- Define and deploy pre-aggregation tables and materialized views

### Priority 2 (Winning Edge)

- Add explainable governance AI layer with evidence references
- Add dashboard previews for activity and governance trends
- Add one-click monthly governance report generation feature

## Delivery Plan and Milestones

### Phase 1: Production Foundations (Week 1)

1. Configure deployment cron jobs for outbox dispatch and token cleanup.
2. Add role seed script and environment validation checks.
3. Add initial operational dashboards and alert rules.

### Phase 2: Admin Experience Completion (Week 2-3)

1. Build invitation management UI with list, resend, revoke.
2. Build user directory with filters and pagination.
3. Build audit log viewer with scoped filters.
4. Add reset password page flow aligned to public token procedures.

### Phase 3: Reliability and Test Hardening (Week 4-5)

1. Add unit tests for orchestrator and collaborators.
2. Add integration tests for critical tRPC procedures.
3. Add E2E tests for invite, activation, role revoke, and deactivate flows.
4. Add failure-path tests for retry and dead-letter behaviors.

### Phase 4: Scalability and Security Enhancements (Week 6-7)

1. Introduce Redis-backed rate limiter abstraction.
2. Add scoped authorization hardening for district-level admin actions.
3. Add advanced observability and incident runbook coverage.

### Phase 5: Final Readiness and Rollout (Week 8)

1. Conduct load, resilience, and security tests.
2. Execute UAT and compliance evidence review.
3. Run staged rollout with canary monitoring.

## Implementation Backlog

| ID     | Work Item                                     | Priority | Owner                | Exit Criteria                                      |
| ------ | --------------------------------------------- | -------- | -------------------- | -------------------------------------------------- |
| UM-001 | Configure cron schedules in deployment config | P0       | Platform             | Scheduled jobs execute in production and monitored |
| UM-002 | Add token expiry cleanup job and telemetry    | P0       | Backend              | Expired tokens are revoked on schedule             |
| UM-003 | Build invitations management page             | P0       | Frontend             | Admin can list, resend, and revoke invitations     |
| UM-004 | Build users directory page with filters       | P0       | Frontend             | Admin can search, paginate, and inspect users      |
| UM-005 | Build audit log viewer                        | P0       | Frontend             | Admin can query and review immutable events        |
| UM-006 | Add reset password page UX                    | P1       | Frontend             | Public reset flow is complete and validated        |
| UM-007 | Add unit tests for core services              | P0       | Backend              | Critical domain logic has high coverage            |
| UM-008 | Add integration tests for users router        | P0       | Backend              | Core admin and public procedures verified          |
| UM-009 | Add E2E tests for user lifecycle              | P0       | QA and Backend       | End-to-end flows pass in CI                        |
| UM-010 | Add distributed rate limiter abstraction      | P1       | Backend              | Public abuse controls scale across instances       |
| UM-011 | Add metrics and alerting dashboards           | P0       | Platform             | SLO dashboards and alerts operational              |
| UM-012 | Publish ops runbook and recovery guide        | P1       | Platform and Backend | On-call can execute failure recovery steps         |

## Testing Strategy

### Unit Tests

- Token issuance and validation behavior
- Invitation state transitions
- Role assignment invariants and audit generation
- Session invalidation behavior on role revoke

### Integration Tests

- createAndInvite idempotency outcomes
- bulkProvision partial success and error capture
- resend and revoke invitation lifecycle
- consumeResetToken and selfRequestPasswordReset behavior

### End-to-End Tests

- Admin provisions and invites user
- User accepts invitation and signs in
- Admin revokes role and active sessions are invalidated
- Admin deactivates user and access is blocked

### Non-Functional Tests

- Load tests for bulk provisioning and invitation listing
- Chaos tests for SMTP failure and retry behavior
- Security tests for enumeration, token replay, and scope bypass attempts

## Risks and Mitigations

| Risk                                               | Impact | Likelihood | Mitigation                                                |
| -------------------------------------------------- | ------ | ---------- | --------------------------------------------------------- |
| Missing cron execution in production               | High   | Medium     | Configure schedules and health checks in week 1           |
| Incomplete admin UX delays adoption                | High   | High       | Prioritize invitation and user directory pages in phase 2 |
| Low test coverage causes regressions               | High   | High       | Implement mandatory CI test gates before release          |
| Public endpoint abuse in multi-instance deployment | Medium | Medium     | Introduce distributed limiter in phase 4                  |
| Limited operational visibility                     | High   | Medium     | Add metrics, traces, and alerting in phase 1 and phase 4  |

## Release and Rollout Plan

1. Dev validation with seeded data and feature flags.
2. Staging rollout with synthetic and manual test passes.
3. Canary release for limited admin tenants.
4. Full rollout after SLO and security gate success for 48 hours.

## Acceptance Criteria

1. All P0 backlog items completed and verified.
2. All critical user lifecycle E2E tests passing in CI.
3. Cron jobs active and observable in production.
4. SLO dashboards and alerting fully operational.
5. Security review passed with no critical findings.
6. Product and operations sign-off completed.

## Engineering Standards for Ongoing Development

1. Keep business rules in services, not in router handlers.
2. Favor composition over inheritance for service extensibility.
3. Keep interfaces narrow and explicit by use case.
4. Do not introduce cross-layer coupling to infrastructure details.
5. Enforce strict type checks and schema validation at every boundary.
6. Require tests for every behavior-changing pull request.
7. Maintain backward-compatible API changes or use versioned contracts.

## Appendix: Initial Repository Touchpoints

- src/server/api/routers/users.ts
- src/server/services/user/
- src/server/services/token/
- src/server/services/email/
- src/app/(gov)/users/page.tsx
- src/app/set-password/page.tsx
- src/env.js
- vercel.json
- drizzle/

## Sign-Off Checklist

- Product sign-off
- Security sign-off
- Platform and SRE sign-off
- Data governance and audit sign-off
- QA sign-off
