# Test Execution Quick Reference

Quick commands to run and verify the new test suite.

## Quick Start

### Run All Unit Tests

```bash
pnpm test
```

Expected output:

```
PASS  src/__tests__/auth/role-scope-enforcement.test.ts
PASS  src/__tests__/ingest/ingest-authorization-scope.test.ts
PASS  src/__tests__/ingest/duplicate-reading-idempotency.test.ts
PASS  src/__tests__/quota/quota-hard-block-boundary.test.ts
PASS  src/__tests__/fao56/fao56-et0-calculation.test.ts

Tests: 52 passed, 52 total
```

---

## By Test Category

### Quota Tests

```bash
pnpm test quota-hard-block-boundary
```

- 9 test cases covering hard-block enforcement
- Tests: 100% utilization boundary, edge cases, precision

### Ingest Tests

```bash
pnpm test -- --testPathPattern="ingest"
```

- Authorization scope: 7 tests (cross-well rejection)
- Deduplication: 11 tests (idempotency, edge cases)

### Auth Tests

```bash
pnpm test role-scope-enforcement
```

- 11 tests covering session, farm/district scope
- Tests: Privilege escalation prevention, role boundaries

### FAO-56 Tests

```bash
pnpm test fao56-et0
```

- 14 tests for ET₀ calculation
- Tests: Reference examples, determinism, plausibility

---

## Advanced Options

### Run with Coverage Report

```bash
pnpm test -- --coverage
```

### Watch Mode (Auto-rerun on File Change)

```bash
pnpm test -- --watch
```

### Run Specific Test File

```bash
pnpm test src/__tests__/quota/quota-hard-block-boundary.test.ts
```

### Verbose Output

```bash
pnpm test -- --reporter=verbose
```

### Debug in Browser

```bash
pnpm test -- --debug
```

Then open `chrome://inspect` and click the test process.

---

## CI/CD Integration

### Pre-Commit Hook

```bash
pnpm test -- --testPathPattern="__tests__" --bail
```

Stops on first failure to prevent commits with failing tests.

### Pre-Push Gate

```bash
pnpm test && pnpm exec playwright test
```

Runs all unit + E2E tests before pushing.

### Release Validation

```bash
pnpm test -- --coverage
pnpm exec playwright test --project=chromium,firefox,webkit
npx checkly trigger
```

---

## Interpreting Test Results

### ✅ Test Passes

```
✓ should reject readings from sensors in a different well
```

The assertion was successful. Feature works as expected.

### ❌ Test Fails

```
● Quota Hard Block Boundary
  ● should hold hard block at exactly 100% boundary

  expect(received).not.toBe(value)

  Expected: not "ok"
  Received: "ok"
```

The assertion failed. Something in production code is broken.

### ⏭️ Test Skipped

```
○ should handle large batches efficiently (SKIPPED)
```

Test marked with `it.skip()`. Use to temporarily disable flaky tests.

---

## Test Failures: Troubleshooting

### "Module not found"

```
Error: Cannot find module 'vitest'
```

Your test runner isn't installed. Run:

```bash
npm install  # or pnpm install
```

### "Database connection failed"

```
Error: ECONNREFUSED localhost:5432
```

This is for **integration tests** (Phase 2). Unit tests don't need a DB.
The unit tests in Phase 1 should pass without any external services.

### "Test times out"

```
Timeout - Async callback was not invoked within 5000 ms
```

Usually means:

1. Test is actually failing (not a timeout)
2. Promise not resolved (check async/await)
3. Genuine timeout (increase with `test(..., () => {}, 10000)`)

For unit tests, shouldn't happen. They use pure functions.

### "Random failures / Flaky tests"

```
✓ Test passes
✓ Test passes
✗ Test fails
✓ Test passes
```

Unit tests should **never** be flaky. If they are:

- Clear random values from tests
- Clear any global state
- Ensure deterministic inputs

Check Phase 1 tests — they all verify determinism.

---

## What Each Test Validates

### Quota Hard Block Boundary

- Authorization: "Reject when utilization > 100%"
- Edge case: "Hold hard block at exactly 100%"
- Precision: "No loss of data at boundaries"
- Determinism: "Same input = same output"

### Ingest Authorization Scope

- Security: "Reject cross-well API key misuse"
- Batch integrity: "Reject one bad reading even if batch valid"
- Error clarity: "Specific reason for rejection"
- Idempotency: "Multiple checks yield same result"

### Duplicate Reading Idempotency

- Deduplication: "Keep newest reading per sensor"
- Retry safety: "Same reading retried = not duplicated"
- Large volume: "Handle 1000+ readings efficiently"
- Determinism: "Repeated calls = same result"

### Role Scope Enforcement

- Isolation: "Farmer X can't access Farm Y"
- Manipulation: "Request tampering is rejected"
- Privilege boundaries: "Farmers can't access districts"
- Expiry: "Expired sessions are rejected"

### FAO-56 ET₀ Calculation

- Reference validation: "Match published FAO-56 examples"
- Determinism: "Same inputs = same output"
- Plausibility: "Results within agronomic ranges"
- Precision: "Correct rounding to 2 decimal places"

---

## Writing New Unit Tests

See the pattern in Phase 1 files:

1. **Start with the invariant docstring**

   ```typescript
   /**
    * Tier 0 Invariant #4: Quota hard block must remain enforceable
    * REQUIREMENT: [What it must do]
    * LAYER: Unit
    */
   ```

2. **Test the contract**

   ```typescript
   it("should reject when utilization exceeds 100%", () => {
     const decision = deriveQuotaDecision({
       quotaM3: 10000,
       consumptionM3: 10001,
     });
     expect(decision.rawState).toBe("exceeded");
   });
   ```

3. **Cover edge cases**
   - Boundaries (0%, 100%, 101%)
   - Error conditions
   - Large volumes

4. **Verify determinism**
   ```typescript
   it("should be deterministic", () => {
     const result1 = logic(input);
     const result2 = logic(input);
     expect(result1).toEqual(result2);
   });
   ```

---

## Questions?

- **Framework**: See [**checks**/README.md](__checks__/README.md)
- **Test patterns**: See [**checks**/PATTERNS.md](__checks__/PATTERNS.md)
- **Roadmap**: See [TESTING_IMPLEMENTATION_ROADMAP.md](TESTING_IMPLEMENTATION_ROADMAP.md)
- **Strategy**: See [docs/testing-strategy-world-class-plan.md](docs/testing-strategy-world-class-plan.md)

---

**Last Updated**: April 2, 2026
