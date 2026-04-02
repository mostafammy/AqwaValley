# AqwaValley E2E Testing Framework

**🚀 Quick Start?** See [QUICKSTART.md](./QUICKSTART.md) to add your first test in 5 minutes.

## Overview

This directory contains production-grade E2E tests, synthetic checks, and API monitors for AqwaValley. The framework is built on the **F.I.R.S.T.** principles and uses industry-standard patterns: **Page Object Model (POM)**, **Builder Pattern** for test data, and **Given-When-Then** for test structure.

## Architecture

### Framework Organization

```
__checks__/
├── support/              # Reusable test infrastructure (POMs, builders, helpers)
│   ├── base-page.ts     # BasePageObject: common page interaction patterns
│   ├── login-page.ts    # LoginPage POM: login screen selectors and interactions
│   ├── login-scenario.ts # LoginScenarioBuilder: test data factory
│   ├── test-data.ts     # Test data builders (users, farms, scenarios)
│   ├── assertions.ts    # BDD assertion helpers (clear, readable assertions)
│   ├── api-check.ts     # APICheckHelper: synthetic check utilities
│   ├── env.ts           # URL resolution from environment variables
│   └── index.ts         # Public API exports
├── homepage.spec.ts      # Login page smoke test (Playwright)
├── login.spec.ts         # Login flow scenarios (Playwright)
├── api.check.ts          # Users API synthetic monitor (Checkly)
├── heartbeat.check.ts    # Scheduled job health monitor (Checkly)
└── url.check.ts          # API availability monitor (Checkly)
```

### Test Types

1. **Browser Tests (Playwright)**
   - `homepage.spec.ts`: Smoke test for login page rendering
   - `login.spec.ts`: Login flow scenarios with BDD structure

2. **Synthetic Checks (Checkly)**
   - `api.check.ts`: API endpoint monitoring
   - `url.check.ts`: HTTP availability monitoring
   - `heartbeat.check.ts`: Scheduled job health checks

## F.I.R.S.T. Principles

All tests follow the F.I.R.S.T. principles for high-quality test design:

### **F**ast
- Tests run in parallel where possible
- No unnecessary waits or sleeps
- Page Object Model reduces selector duplication
- Synthetic checks are lightweight HTTP requests

**Example:**
```typescript
// Fast: single interaction, minimal assertions
await test.step("Then the form is visible", async () => {
  await assertForm(page).isVisible().hasLabel("National ID");
});
```

### **I**solated
- Each test is independent and can run in any order
- No shared state or test interdependencies
- Test data builders create fresh fixtures
- Base URLs are environment-configurable

**Example:**
```typescript
// Isolated: each scenario builds its own data
const scenario = testLoginScenario()
  .asAdminUser()
  .build();
```

### **R**epeatable
- Same test produces same result every time
- Deterministic selectors (data-testid, accessible names)
- No flaky waits or timing assumptions
- Environment-based configuration

**Example:**
```typescript
// Repeatable: stable selector, auto-waiting
async fillNationalId(nationalId: string) {
  await this.fillInput(this.nationalIdInput(), nationalId);
}
```

### **S**elf-Checking
- Clear, explicit assertions that fail immediately
- No assumptions or ambiguous checks
- Error messages are descriptive and actionable
- Tests don't require manual verification

**Example:**
```typescript
// Self-checking: explicit, fails fast if element missing
await expect(this.submitButton()).toHaveText(scenario.submitLabel);
```

### **T**imely
- Written early in the development cycle
- Run on every push and deployment
- Smoke tests catch regressions quickly
- Synthetic monitors run continuously in production

**Example:**
```typescript
// Timely: smoke test runs on every commit and deploy
test("renders the AqwaValley login surface with all controls stable", ...)
```

## Page Object Model (POM)

The POM pattern encapsulates page selectors and interactions into reusable classes. Instead of scattering selectors throughout tests, they're centralized in a single place.

### BasePageObject

Provides common utilities inherited by specific pages:

```typescript
class BasePageObject {
  // Navigation & loading
  async goto(path: string)                              // Navigate and wait
  async waitForElement(locator): Promise<Locator>      // Auto-wait for availability
  async screenshot(name: string)                       // Evidence capture

  // Interactions
  async fillInput(locator, value)                      // Fill with auto-clearing
  async clickButton(locator)                           // Click with auto-waiting
  
  // Assertions
  async expectURL(pattern: RegExp | string)
  async expectTitle(pattern: RegExp | string)
  async expectVisible(locator)
  async expectText(locator, text)
  async expectAttribute(locator, attr, value)
}
```

### LoginPage (Extends BasePageObject)

Wraps login-specific selectors and interactions:

```typescript
class LoginPage extends BasePageObject {
  // Locators (stable selectors by test-id)
  nationalIdInput() { return this.page.getByTestId("national-id-input"); }
  passwordInput() { return this.page.getByTestId("password-input"); }
  submitButton() { return this.page.getByTestId("login-submit"); }
  
  // Interactions (high-level, business-focused)
  async fillNationalId(id: string)
  async fillPassword(pwd: string)
  async submit()
  async login(id: string, pwd: string)
  
  // Assertions (explicit, clear)
  async expectLoaded(scenario)
  async expectControls(scenario)
  async expectError(errorText)
}
```

**Usage in tests:**
```typescript
const loginPage = new LoginPage(page);
await loginPage.login("29901011234567", "SecurePassword@123");
await loginPage.expectError("Invalid credentials");
```

## Builder Pattern (Test Data)

Builders provide a fluent API for constructing test data with sensible defaults. This ensures consistency and makes tests more readable.

### Test Data Builders

```typescript
// User builder
const user = testUser()
  .withNationalId("29901011234567")
  .withRole("admin")
  .build();

// Farm builder
const farm = testFarm()
  .withDistrictId("district-001")
  .withQuotaLimitLiters(5000)
  .build();

// Complete scenario
const scenario = testLoginScenario()
  .asAdminUser()
  .withExpectedPath("/admin/dashboard")
  .build();
```

**Principles:**
- Defaults are realistic and minimal
- Builders are composable
- Build method returns immutable copy (no side effects)
- Each test scenario can override exactly what it needs

## Given-When-Then (BDD Pattern)

Tests are structured as business-readable Given-When-Then steps using Playwright's `test.step()`.

### Example Test

```typescript
test("login redirects authorized users to dashboard", async ({ page }) => {
  const scenario = testLoginScenario().build();
  const loginPage = new LoginPage(page);

  // Given: Setup preconditions
  await test.step("Given a valid user arrives at login", async () => {
    await loginPage.goto("/");
  });

  // When: Perform action
  await test.step("When the user enters valid credentials and submits", async () => {
    await loginPage.login(scenario.user.nationalId, scenario.user.password);
  });

  // Then: Assert results
  await test.step("Then they are redirected to the dashboard", async () => {
    await assertPage(page).navigatedTo(scenario.expectedPath);
  });
});
```

**Benefits:**
- Tests read like requirements documents
- Developers and QA can both understand the flow
- Failures point to which step broke
- Easy to add or skip steps

## Assertion Helpers

The `assertions.ts` module provides fluent assertion builders for common patterns:

### FormAssertions

```typescript
await assertForm(page)
  .isVisible()
  .hasLabel("National ID")
  .hasInput("national-id-input")
  .hasButton("login-submit", "تسجيل الدخول")
  .hasError("Invalid credentials");
```

### PageAssertions

```typescript
await assertPage(page)
  .loadedWithTitle(/AqwaValley/)
  .loadedWithURL("/")
  .containsText("أكوا الوادي")
  .navigatedTo("/dashboard");
```

### APIAssertions

```typescript
const response = await apiCheck(baseUrl).get("/api/users");
helper.assertStatus(response, 200);
helper.assertHeader(response, "content-type", "application/json");
helper.assertResponseTime(response, 5000);
helper.assertSecurityHeaders(response);
```

## Selector Strategy

Tests use a priority order for locators, ensuring they're both stable and accessible:

1. **data-testid** (Most stable, explicit for testing)
   ```html
   <input data-testid="national-id-input" />
   ```
   ```typescript
   page.getByTestId("national-id-input")
   ```

2. **Accessible Names** (Semantic, accessible to assistive tech)
   ```html
   <label>National ID</label>
   <input aria-label="National ID" />
   ```
   ```typescript
   page.getByLabel("National ID")
   ```

3. **Role + Text** (Last resort, most brittle)
   ```typescript
   page.getByRole("button", { name: "تسجيل الدخول" })
   ```

**Never use:**
- CSS selectors like `.login-form input:first-child`
- XPath locators
- HTML element structure assumptions
- Magic indices

## Running Tests

### Playwright Tests (Local)

```bash
# Install dependencies
pnpm install

# Run all Playwright tests
pnpm playwright test

# Run specific test file
pnpm playwright test __checks__/homepage.spec.ts

# Run in headed mode (see browser)
pnpm playwright test --headed

# Debug mode
pnpm playwright test --debug
```

### Checkly Checks (Synthetic Monitoring)

```bash
# Validate configuration
pnpm checkly validate

# Deploy checks (requires authentication)
pnpm checkly deploy

# Run checks locally
pnpm checkly check run
```

### Environment Configuration

Tests resolve the base URL in this order:

1. `AQWA_VALLEY_URL` (highest priority)
2. `CHECKLY_BASE_URL` (Checkly-provided)
3. `ENVIRONMENT_URL` (deployment environment)
4. `http://localhost:3000` (default local)

**Set for different environments:**
```bash
# Local development (default)
pnpm playwright test

# Against staging
ENVIRONMENT_URL=https://staging.aqwavalley.com pnpm playwright test

# Against production
AQWA_VALLEY_URL=https://aqwavalley.com pnpm playwright test
```

## Best Practices

### Do's ✅
- Use `data-testid` for stable selectors
- Build test data with builders, not hard-coded values
- Write assertions that describe the business value
- Keep test steps focused and single-purpose
- Use BDD structure (Given-When-Then) for clarity
- Screenshot critical moments for evidence
- Handle async properly (waitForLoadState, expect auto-retry)

### Don'ts ❌
- Hard-code values or IDs
- Use CSS selector hacks or index-based queries
- Create shared test state or fixtures
- Sleep or arbitrary waits (use auto-waiting instead)
- Test implementation details instead of behavior
- Skip or ignore flaky tests (fix the root cause)
- Run tests in a specific order (each should be independent)

## Debugging Flaky Tests

If a test is flaky:

1. **Check selectors**: Use `await page.pause()` to inspect elements
2. **Verify waiting**: Ensure `waitForLoadState()` or `expect()` waits are sufficient
3. **Check timing**: Don't rely on `setTimeout()`; use `waitForElement()`
4. **Review state**: Use screenshots or logs to see what the page actually is
5. **Isolate**: Run the test alone multiple times to reproduce

```typescript
// Debug: pause and inspect
await test.step("Debug: pause and inspect", async () => {
  await page.pause(); // Opens DevTools in headed browser
});

// Debug: log locator status
const button = page.getByTestId("login-submit");
console.log(await button.isVisible()); // Check visibility
console.log(await button.isEnabled());  // Check enabled state
```

## Performance Considerations

### Parallel Execution
- Tests that don't share state can run in parallel
- Playwright runs workers in parallel by default
- Checkly can run checks from multiple geographic locations

### Caching
- Use `waitForLoadState("networkidle")` to wait for net work completion
- Screenshot caching helps with visual regression detection
- Environment variables prevent redundant rebuilds

### Timeouts
- Browser timeout: 30 seconds (Playwright default)
- Navigation timeout: 30 seconds
- Action timeout: 10 seconds
- Response timeout: varies by check (e.g., 20s for API checks)

## Contributing New Tests

### Checklist

- [ ] Test follows F.I.R.S.T. principles
- [ ] Selectors use `data-testid` or accessible names
- [ ] Test data comes from builders, not hardcoded
- [ ] Test uses Given-When-Then structure
- [ ] Assertions are explicit and clear
- [ ] Test runs reliably (no flakiness)
- [ ] Test includes comments for non-obvious logic
- [ ] Test has descriptive name matching behavior

### Adding a New POM

```typescript
// 1. Create dashboard-page.ts
export class DashboardPage extends BasePageObject {
  // Locators
  welcomeHeading() { return this.page.getByTestId("dashboard-welcome"); }
  farmList() { return this.page.getByTestId("farm-list"); }
  
  // Interactions
  async navigateToFarm(farmId: string) {
    await this.page.getByTestId(`farm-${farmId}`).click();
  }
  
  // Assertions
  async expectLoaded(scenario) {
    await this.expectVisible(this.welcomeHeading());
    await this.expectText(this.welcomeHeading(), scenario.expectedGreeting);
  }
}

// 2. Export from support/index.ts
export { DashboardPage } from "./dashboard-page";

// 3. Use in tests
const dashboardPage = new DashboardPage(page);
await dashboardPage.expectLoaded(scenario);
```

## Related Documentation

- **[PATTERNS.md](./PATTERNS.md)** — Visual guide with side-by-side examples of correct vs incorrect testing patterns
- **Testing Strategy** — [docs/testing-strategy-world-class-plan.md](../docs/testing-strategy-world-class-plan.md)

## Reference Documentation

- **Playwright**: https://playwright.dev/docs/intro
- **Checkly**: https://www.checklyhq.com/docs/
- **Testing Library Best Practices**: https://testing-library.com/docs/guiding-principles
- **F.I.R.S.T. Principles**: https://medium.com/javascript-scene/what-every-unit-test-needs-f6cd34d9836d
- **Page Object Model**: https://playwright.dev/docs/pom

## Support & Questions

For questions or to report test issues:

1. Check existing test examples (homepage.spec.ts, login.spec.ts)
2. Review the support layer (support/base-page.ts, support/assertions.ts)
3. Run tests locally in debug mode with `page.pause()`

---

**Last Updated**: April 2, 2026
**Status**: Production-Grade Testing Framework (v1)
