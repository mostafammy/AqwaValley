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
- Existing end-to-end checks in [**checks**/](../__checks__)
- Scenario scripts in [scripts/](../scripts)
- Domain documentation for ingest, quotas, reporting, and user management in
  [docs/](../docs)

The current gap is not absence of tools. The gap is the lack of a coherent test
architecture, explicit quality gates, and a prioritized test matrix that maps
to real production risk.

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

## Priority Test Matrix

### Tier 0: Must Never Break

- Authentication and session handling
- Authorization and scope checks
- Sensor ingest acceptance and rejection behavior
- Quota enforcement and threshold decisions
- Report generation and export correctness
- User provisioning and role management
- Cron scheduling and idempotency

### Tier 1: High Value

- Dashboard and management pages
- Search, filtering, pagination, and sorting
- Notification and email workflows
- Audit trail visibility
- Error boundaries and fallback states

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

### Ingest and Time-Series Data

What to test:

- valid and invalid API key handling
- batch ingest acceptance limits
- duplicate reading handling
- TimescaleDB persistence and querying
- alert trigger logic and suppression windows
- denormalized read models remaining consistent enough for the UI

### Quotas and Governance

What to test:

- quota calculation boundaries
- farm and district scope correctness
- ABAC enforcement
- historical decision reproducibility
- audit trail completeness

### Reporting

What to test:

- report parameter validation
- async job lifecycle
- deterministic exports
- access control on download links
- large data volume behavior

### Frontend and UX

What to test:

- critical page load and render states
- loading, empty, and error states
- form validation and submission feedback
- responsive layout for tablet and mobile sizes
- accessibility basics such as labels, headings, contrast, and keyboard flow

### Operational Jobs and Cron

What to test:

- scheduled execution
- retry behavior
- replay safety
- dead-letter or failure reporting
- observability output

## Test Data Strategy

### Data Principles

- Use minimal fixtures that still look like production.
- Prefer domain builders over large static SQL dumps.
- Make every important scenario reproducible by seed name.
- Keep dates, IDs, and time windows deterministic.
- Test data should make the failure obvious when it fails.

### Fixture Design

Recommended fixture patterns:

- `buildUserScenario()` for role and district access cases
- `buildWellScenario()` for ingest and alert cases
- `buildQuotaScenario()` for consumption and policy cases
- `buildReportScenario()` for export and snapshot cases
- `buildCronScenario()` for scheduled runs

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

## Performance-Focused Testing

Performance tests should target the places where AqwaValley can hurt users:

- ingest throughput
- report generation time
- dashboard list queries
- cron execution duration
- auth and redirect latency

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

## Recommended Rollout Roadmap

### Phase 1: Foundation

- Define test naming conventions and folder structure.
- Add scenario builders and fixture factories.
- Standardize local and CI commands.
- Establish the release gates.

### Phase 2: Coverage On Critical Paths

- Add coverage for auth, ingest, quotas, and reports.
- Add browser smoke flows for the main journeys.
- Add synthetic checks for deployed endpoints.

### Phase 3: Reliability And Scale

- Add replay, retry, and idempotency tests.
- Add performance and soak validation for the busiest flows.
- Tighten flakiness management and reporting.

### Phase 4: Continuous Improvement

- Use production incidents to create regression tests.
- Remove obsolete tests and simplify fixtures.
- Expand contract tests as APIs evolve.

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
