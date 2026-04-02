# Quick Start Guide

Add your first E2E test to AqwaValley in 5 minutes.

## 1. Understand the Existing Patterns

Look at working examples:
- **Simple test**: [homepage.spec.ts](./homepage.spec.ts) — Load page and verify UI
- **Complex test**: [login.spec.ts](./login.spec.ts) — Multiple scenarios with test data builders

Key files you'll use:
- [support/base-page.ts](./support/base-page.ts) — Common page utilities (inherit from this)
- [support/test-data.ts](./support/test-data.ts) — Test data factories (use these)
- [support/assertions.ts](./support/assertions.ts) — BDD assertions (use these)

## 2. Copy the Template

Create a new test file `my-feature.spec.ts`:

```typescript
import { test } from "@playwright/test";
import { assertPage, assertForm } from "./support/assertions";

const BASE_URL = process.env.AQWA_VALLEY_URL || "http://localhost:3000";

test.describe("My Feature", () => {
  test("should do something specific", async ({ page }) => {
    // Given: Setup
    await test.step("Given I'm on the my-feature page", async () => {
      await page.goto(`${BASE_URL}/my-feature`);
    });

    // When: Perform action
    await test.step("When I interact with the UI", async () => {
      await page
        .getByTestId("my-button")
        .click();
    });

    // Then: Verify result
    await test.step("Then the expected result appears", async () => {
      await assertPage(page).containsText("Success message");
    });
  });
});
```

## 3. Replace Selectors with Page Object

If your test targets the same page in multiple tests, create a POM:

```typescript
// support/my-feature-page.ts
import { BasePageObject } from "./base-page";

export class MyFeaturePage extends BasePageObject {
  // Locators
  myButton() { return this.page.getByTestId("my-button"); }

  // Interactions
  async clickMyButton() {
    await this.clickButton(this.myButton());
  }

  // Assertions
  async expectSuccess() {
    await this.expectVisible(this.myButton());
  }
}

// Now in your test:
import { MyFeaturePage } from "./support/my-feature-page";

test("feature works", async ({ page }) => {
  const feature = new MyFeaturePage(page);
  await feature.goto("/my-feature");
  await feature.clickMyButton();
  await feature.expectSuccess();
});
```

## 4. Use Test Data Builders

Replace hard-coded values with builders:

```typescript
// Before: Hard-coded data
const user = {
  nationalId: "12345678901234",
  password: "TestPassword123",
  role: "farmer",
};

// After: Use builders
const scenario = testLoginScenario()
  .asAdminUser() // Predefined role
  .build();

// Now in tests:
await login.login(scenario.user.nationalId, scenario.user.password);
```

## 5. Run Your Test Locally

```bash
# Run all tests
pnpm exec playwright test

# Run one test file
pnpm exec playwright test my-feature.spec.ts

# Run in debug mode (opens Inspector)
pnpm exec playwright test --debug

# Run in headed mode (see browser)
pnpm exec playwright test --headed

# Watch mode (re-run on file changes)
pnpm exec playwright test --watch
```

## 6. Debug Flaky Tests

Tests fail intermittently? Use these tools:

```typescript
test("debug failing test", async ({ page }) => {
  // Pause and open DevTools
  await page.pause();
  
  // Or take a screenshot
  await page.screenshot({ path: "debug.png" });
  
  // Or inspect element state
  console.log(await page.getByTestId("element").isVisible());
});
```

```bash
# Run with trace (see full test execution)
pnpm exec playwright test --trace on

# View trace
npx playwright show-trace trace.zip
```

## 7. Common Patterns

### Fill a Form

```typescript
const page = new LoginPage(page);
await page.fillNationalId("12345678901234");
await page.fillPassword("password");
await page.submit();
```

### Verify Navigation

```typescript
await assertPage(page).navigatedTo("/dashboard");
```

### Verify Text Content

```typescript
await assertForm(page).containsText("Welcome, Admin");
```

### Verify Form State

```typescript
await assertForm(page)
  .isVisible()
  .hasLabel("National ID")
  .hasButton("Submit");
```

### API Check (Synthetic Monitoring)

```typescript
// checks/my-api.check.ts
new ApiCheck("my-api-check", {
  name: "My API",
  request: {
    url: "https://api.example.com/endpoint",
    method: "GET",
    assertions: [
      AssertionBuilder.statusCode().equals(200),
      AssertionBuilder.header("content-type").contains("application/json"),
    ],
  },
});
```

## 8. Write Better Selectors

Priority order (best → worst):

1. **data-testid** (explicit, stable)
   ```html
   <button data-testid="submit-button">Submit</button>
   ```
   ```typescript
   page.getByTestId("submit-button")
   ```

2. **Accessible labels** (semantic, user-focused)
   ```html
   <label for="email">Email</label>
   <input id="email" />
   ```
   ```typescript
   page.getByLabel("Email")
   ```

3. **Button/Link text** (user-facing)
   ```html
   <button>Login</button>
   ```
   ```typescript
   page.getByRole("button", { name: "Login" })
   ```

4. ❌ **Avoid**: CSS selectors, XPath, element hierarchy
   ```typescript
   // BAD - brittle, not semantic
   page.locator("#form > div > input:first-child")
   ```

## 9. Review Checklist

Before submitting your test:

- [ ] Test follows Given-When-Then structure with `test.step()`
- [ ] Selectors use `data-testid` or accessible names
- [ ] Test data comes from builders, not hard-coded
- [ ] No `setTimeout()` — use auto-waiting instead
- [ ] Test name describes *what* it validates, not *how*
- [ ] Run locally: `pnpm exec playwright test --headed`
- [ ] No flakiness: Run locally multiple times
- [ ] Check for duplication — can you use a POM or builder?

## 10. Next Steps

**New to E2E tests?**
- Read [PATTERNS.md](./PATTERNS.md) for detailed before/after examples
- Study [login.spec.ts](./login.spec.ts) to see BDD structure at scale

**Adding to an existing page?**
- Extend [support/login-page.ts](./support/login-page.ts) as an example
- Follow the same pattern for your page object

**Adding API tests?**
- See [api.check.ts](./api.check.ts) for synthetic check examples
- Use [support/api-check.ts](./support/api-check.ts) helper

**Need help?**
- Check [README.md](./README.md) for full documentation
- Look at [testing-strategy-world-class-plan.md](../docs/testing-strategy-world-class-plan.md) for what to test

---

**Remember**: Good tests are like good documentation — they explain what the system should do, not how it does it.

Happy testing! 🚀
