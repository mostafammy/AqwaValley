---
post_title: "AqwaValley Reporting Endpoints API Contract"
author1: "AqwaValley Engineering"
post_slug: "aqwavalley-reporting-endpoints-api-contract"
microsoft_alias: "aqwavalley"
featured_image: "https://example.com/aqwavalley-report-endpoints.jpg"
categories:
  - Engineering
  - Architecture
  - Data Platform
tags:
  - reporting
  - api
  - trpc
  - frontend
  - contract
ai_note: "AI-assisted draft, reviewed by engineering"
summary: "Frontend implementation contract for Reporting Engine endpoints, including tRPC procedures, download route behavior, auth rules, validation constraints, error mapping, and recommended UI integration flow."
post_date: "2026-04-01"
---

## Purpose

This document is the frontend-facing API contract for the reporting endpoints
implemented in the report-generation-endpoints branch.

Use this as the source of truth for:

- request payloads
- response shapes
- auth expectations
- error handling
- recommended client flow

## Contract Scope

This contract covers:

- tRPC router: `reports.*`
- HTTP download route: `GET /api/reports/download/{artifactId}`
- Cron worker route: `POST/GET /api/cron/process-report-jobs` (ops only)

## Authentication and Authorization

### Session requirement

All `reports.*` procedures require an authenticated session.

- Unauthenticated calls return `UNAUTHORIZED`.

### Role and scope rules

- `reports.processQueue` requires admin role.
- `reports.requestGeneration`, `reports.listJobs`, `reports.getJob`,
  `reports.getDownloadLink`, `reports.runMonthlyGovernancePack`,
  `reports.getSupportedReportTypes`, and `reports.validateScope`
  require authenticated viewer access.
- Global scope requests are allowed only for admin or auditor roles.
- Users can view only their own jobs unless they are admin or auditor.

### Download route rules

`GET /api/reports/download/{artifactId}`:

- requires authenticated session
- validates artifact readiness and expiry
- validates report-view permission against job owner and roles
- streams file on success

## Enums and Shared Values

### Report types

- `user_activity`
- `district_governance`
- `compliance`
- `audit_trail`
- `monthly_governance_pack`

### Formats

- `pdf`
- `csv`
- `xlsx`

### Scope types

- `global`
- `district`
- `farm`
- `user`

### Job status

- `queued`
- `processing`
- `completed`
- `partial_failed`
- `failed`
- `cancelled`

### Generation mode

- `strict`
- `partial`

### Snapshot type

- `logical`
- `physical`

## tRPC Endpoints

### 1) reports.requestGeneration

Create or reuse a report job.

#### Input

```json
{
  "reportType": "user_activity",
  "formats": ["pdf", "csv", "xlsx"],
  "generationMode": "strict",
  "timeRangeFrom": "2026-03-01T00:00:00.000Z",
  "timeRangeTo": "2026-03-31T23:59:59.999Z",
  "granularity": "daily",
  "scope": {
    "scopeType": "district",
    "districtId": "3bd4e9f4-954a-4d4f-a986-b274e995f645"
  },
  "parameterSchemaVersion": "report-params-v1",
  "templateVersion": "v1",
  "policyVersion": "policy-current",
  "maskingRulesVersion": "masking-current",
  "snapshotId": "snap_2026_03_31_01",
  "snapshotType": "logical",
  "snapshotMetadata": {
    "trigger": "report-center"
  },
  "parameters": {
    "includeInactive": true
  }
}
```

#### Validation notes

- `formats` must contain at least one item.
- `scope.scopeType = district` requires `districtId`.
- `scope.scopeType = farm` requires `farmId`.
- `scope.scopeType = user` requires `userId`.

#### Response

```json
{
  "reportJobId": "46b5a27e-4142-4c8f-875f-b3643901a9a1",
  "reused": false,
  "status": "queued"
}
```

### 2) reports.listJobs

List jobs visible to current user.

#### Input

```json
{
  "status": "completed",
  "page": 1,
  "pageSize": 20
}
```

#### Response

```json
{
  "items": [
    {
      "id": "46b5a27e-4142-4c8f-875f-b3643901a9a1",
      "reportType": "user_activity",
      "status": "completed",
      "requestedBy": "usr_123",
      "createdAt": "2026-04-01T11:25:04.000Z"
    }
  ],
  "total": 1
}
```

### 3) reports.getJob

Get a single job with its generated artifacts.

#### Input

```json
{
  "reportJobId": "46b5a27e-4142-4c8f-875f-b3643901a9a1"
}
```

#### Response

```json
{
  "job": {
    "id": "46b5a27e-4142-4c8f-875f-b3643901a9a1",
    "status": "completed",
    "reportType": "user_activity"
  },
  "artifacts": [
    {
      "id": "eff496f0-c500-44b1-88e7-938de35ca513",
      "reportJobId": "46b5a27e-4142-4c8f-875f-b3643901a9a1",
      "format": "pdf",
      "status": "ready",
      "contentType": "application/pdf",
      "fileSizeBytes": 88422,
      "expiresAt": "2026-04-08T11:25:05.000Z"
    }
  ]
}
```

### 4) reports.getDownloadLink

Issue a secure application URL for a specific artifact.

#### Input

```json
{
  "reportArtifactId": "eff496f0-c500-44b1-88e7-938de35ca513"
}
```

#### Response

```json
{
  "signedUrl": "/api/reports/download/eff496f0-c500-44b1-88e7-938de35ca513",
  "expiresAt": "2026-04-02T11:25:07.000Z",
  "contentType": "application/pdf"
}
```

Frontend should navigate browser to `signedUrl` to trigger download.

### 5) reports.runMonthlyGovernancePack

Convenience mutation for one-click governance pack generation.

#### Input

```json
{
  "districtId": "3bd4e9f4-954a-4d4f-a986-b274e995f645",
  "snapshotId": "snap_2026_03_31_01",
  "templateVersion": "v1",
  "policyVersion": "policy-current",
  "maskingRulesVersion": "masking-current"
}
```

#### Response

Same shape as `reports.requestGeneration`.

### 6) reports.getSupportedReportTypes

#### Input

No input.

#### Response

```json
[
  "user_activity",
  "district_governance",
  "compliance",
  "audit_trail",
  "monthly_governance_pack"
]
```

### 7) reports.validateScope

Preflight scope authorization check.

#### Input

```json
{
  "scopeType": "farm",
  "farmId": "a86ab4d6-9944-4b8f-b602-cfdd2f7d996f"
}
```

#### Response (allowed)

```json
{
  "allowed": true
}
```

#### Response (denied)

```json
{
  "allowed": false,
  "reason": "Insufficient permissions for user-scoped report"
}
```

### 8) reports.processQueue (ops/admin)

Admin-only mutation to process queued jobs.

#### Input

```json
{
  "maxJobs": 10
}
```

#### Response

```json
{
  "scanned": 10,
  "completed": 9,
  "failed": 1
}
```

Not intended for report center UI usage.

## Download Route Contract

### Endpoint

`GET /api/reports/download/{artifactId}`

### Success response

- HTTP `200`
- stream body (binary)
- headers:
  - `content-type`
  - `content-length`
  - `content-disposition: attachment; filename="{artifactId}.{format}"`
  - `cache-control: private, no-store`

### Error responses

- `401`: `{ "error": "UNAUTHORIZED" }`
- `403`: `{ "error": "FORBIDDEN" }`
- `404`: `{ "error": "ARTIFACT_NOT_FOUND" }`
- `404`: `{ "error": "ARTIFACT_EXPIRED" }`
- `404`: `{ "error": "REPORT_JOB_NOT_FOUND" }`
- `404`: `{ "error": "ARTIFACT_STORAGE_MISSING" }`

## Cron Route Contract (Platform/Ops)

### Endpoint

- `POST /api/cron/process-report-jobs`
- `GET /api/cron/process-report-jobs`

### Auth

Requires cron secret via either:

- `Authorization: Bearer <CRON_SECRET>`
- `x-cron-secret: <CRON_SECRET>`

### Input (optional)

```json
{
  "maxJobs": 10
}
```

### Success

```json
{
  "ok": true,
  "scanned": 10,
  "completed": 8,
  "failed": 2
}
```

### Errors

- `401`: `{ "ok": false, "error": "Missing cron secret" }`
- `401`: `{ "ok": false, "error": "Invalid cron secret" }`
- `400`: `{ "ok": false, "error": "Invalid cron payload", "details": ... }`

## Recommended Frontend Integration Flow

1. Call `reports.getSupportedReportTypes` on page load.
2. Build filter form with report type, scope, time window, and formats.
3. Optionally call `reports.validateScope` before submit for faster UX feedback.
4. Submit `reports.requestGeneration`.
5. Poll `reports.getJob` every 2 to 5 seconds until terminal status:
   - `completed`
   - `partial_failed`
   - `failed`
   - `cancelled`
6. For each ready artifact, call `reports.getDownloadLink` and open `signedUrl`.
7. Stop polling after terminal status, show per-artifact outcomes.

## Frontend UX State Model

### Job states

- `queued`: show queued indicator
- `processing`: show progress indicator
- `completed`: enable all artifact downloads
- `partial_failed`: enable ready artifact downloads and show retry guidance
- `failed`: show actionable error state
- `cancelled`: show cancelled state

### Artifact states

- `ready`: download button enabled
- `failed`: show failure reason if available
- `expired`: show regenerate action

## Error Handling Contract

### tRPC

Map common codes:

- `UNAUTHORIZED`: redirect to sign-in or show session expired dialog
- `FORBIDDEN`: show scope/role permission message
- `NOT_FOUND`: show resource unavailable state
- `BAD_REQUEST`/zod validation errors: show inline form validation

### Download route

If download returns JSON error, map by `error` field to user-friendly text.

## Pagination Contract for Job List

For `reports.listJobs`:

- request uses `page` (1-based) and `pageSize`
- response returns `total`
- frontend computes:

```text
totalPages = ceil(total / pageSize)
```

## Backward Compatibility

Treat this as v1 contract.

For future changes:

- add fields without breaking existing fields
- avoid changing enum values without a migration window
- if breaking changes are required, introduce `reportsV2` router namespace

## Frontend Team Checklist

- Use type-safe tRPC client procedures matching endpoint names.
- Always send explicit `templateVersion`, `policyVersion`, and
  `maskingRulesVersion`.
- Persist `reportJobId` in UI state and URL when possible.
- Gate download buttons by artifact status and expiry.
- Implement resilient polling with retry and cancellation.
- Handle `partial_failed` as a first-class success-with-warnings state.
- Log job and artifact IDs in client telemetry for supportability.
