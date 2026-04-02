# Testing Patterns & Anti-Patterns

This guide shows real examples of correct and incorrect test patterns used in AqwaValley's test suite.

## DRY Principle: Selectors & Locators

### ❌ Anti-Pattern: Scattered Selectors

```typescript
// BAD: Selectors duplicated across tests
test("user can login", async ({ page }) => {
  await page.getByTestId("national-id-input").fill("29901011234567");
  await page.getByTestId("password-input").fill("password");
  await page.getByTestId("login-submit").click();
});

test("shows error on invalid login", async ({ page }) => {
  await page.getByTestId("national-id-input").fill("invalid");
  await page.getByTestId("password-input").fill("wrong");
  await page.getByTestId("login-submit").click();
  // If selector changes, must update in multiple places ❌
});
```

### ✅ Correct Pattern: Centralized in POM

```typescript
// GOOD: Selectors in one place (LoginPage)
class LoginPage extends BasePageObject {
  nationalIdInput() {
    return this.page.getByTestId("national-id-input");
  }
  passwordInput() {
    return this.page.getByTestId("password-input");
  }
  submitButton() {
    return this.page.getByTestId("login-submit");
  }

  async fillNationalId(id: string) {
    await this.fillInput(this.nationalIdInput(), id);
  }
  async fillPassword(pwd: string) {
    await this.fillInput(this.passwordInput(), pwd);
  }
  async submit() {
    await this.clickButton(this.submitButton());
  }
}

// Now tests aren't coupled to selectors
test("user can login", async ({ page }) => {
  const login = new LoginPage(page);
  await login.fillNationalId("29901011234567");
  await login.fillPassword("password");
  await login.submit();
  // If selector changes, only LoginPage needs updating ✅
});
```

## Test Data: Hard-coded vs Builders

### ❌ Anti-Pattern: Hard-coded Test Data

```typescript
// BAD: Data scattered and duplicated
test("admin can view all users", async ({ page }) => {
  // Hard-coded user data
  const user = {
    id: "user-123",
    nationalId: "12345678901234",
    name: "Test Admin",
    role: "admin",
  };

  await page.goto("/login");
  await page.getByLabel("National ID").fill(user.nationalId);
  await page.getByLabel("Password").fill("TestPass123");
  await page.getByRole("button", { name: "Login" }).click();
});

test("admin can approve sensors", async ({ page }) => {
  // Same data copied and maintained separately
  const user = {
    id: "user-123",
    nationalId: "12345678901234",
    name: "Test Admin",
    role: "admin",
  };
  // Now we have two copies to keep in sync 😞
});
```

### ✅ Correct Pattern: Test Data Builders

```typescript
// GOOD: Single source of truth with builders
const scenario = testLoginScenario().asAdminUser().build();

test("admin can view all users", async ({ page }) => {
  const login = new LoginPage(page);
  await login.login(scenario.user.nationalId, scenario.user.password);
  // Data is defined once, used everywhere ✅
});

test("admin can approve sensors", async ({ page }) => {
  const login = new LoginPage(page);
  await login.login(scenario.user.nationalId, scenario.user.password);
  // Same scenario, no duplication ✅
});

// Customize a single scenario without affecting others
test("guest user sees limited dashboard", async ({ page }) => {
  const guestScenario = testLoginScenario().withUser({ role: "guest" }).build();
  // Each test defines only what it cares about ✅
});
```

## Auto-Waiting: Implicit vs Explicit

### ❌ Anti-Pattern: Hard-coded Waits

```typescript
// BAD: Timing-based waits (flaky!)
test("form submission works", async ({ page }) => {
  await page.getByTestId("submit-button").click();

  // Magic number: assumes the page takes 500ms to navigate
  await new Promise((resolve) => setTimeout(resolve, 500)); // ❌ Flaky!

  // What if the page takes 600ms? Test fails randomly.
  // What if the page takes 100ms? Test wastes 400ms unnecessarily.

  await expect(page).toHaveURL("/dashboard");
});
```

### ✅ Correct Pattern: Playwright Auto-Waiting

```typescript
// GOOD: Let Playwright wait intelligently
class BasePageObject {
  async fillInput(locator, value) {
    await this.waitForElement(locator); // Wait until visible & stable
    await locator.clear();
    await locator.fill(value); // Playwright auto-waits to type
  }

  async clickButton(locator) {
    await this.waitForElement(locator);
    await locator.click(); // Playwright auto-waits until clickable
  }
}

test("form submission works", async ({ page }) => {
  const form = new LoginPage(page);

  // These auto-wait:
  await form.fillNationalId("123"); // Waits for input visible
  await form.fillPassword("pwd"); // Waits for input visible
  await form.submit(); // Waits for button clickable

  // Auto-retry: Playwright waits up to 30s for the URL to match
  await expect(page).toHaveURL("/dashboard");
  // ✅ No flakiness, no wasted time
});
```

## Assertions: Ambiguous vs Explicit

### ❌ Anti-Pattern: Vague Assertions

```typescript
// BAD: Unclear what we're testing
test("dashboard loads", async ({ page }) => {
  await page.goto("/dashboard");

  // Is the page actually loaded? What defines "loaded"?
  const hasContent = await page.content();
  expect(hasContent.length).toBeGreaterThan(100); // Vague! ❌

  // Did the right page load or just any page with content?
  const heading = await page.locator("h1");
  expect(heading).toBeDefined(); // Defined or visible? ❌

  // This test would pass even if the page failed to render
});
```

### ✅ Correct Pattern: Explicit Assertions

```typescript
// GOOD: Clear, specific assertions
test("dashboard loads with user info", async ({ page }) => {
  await page.goto("/dashboard");

  // Assert specific content, not just "something loaded"
  await assertPage(page)
    .loadedWithURL("/dashboard") // Right page
    .loadedWithTitle(/Dashboard/) // Right title
    .containsText("Welcome, Admin"); // Expected content

  // Assert specific elements are in the right state
  const farmList = page.getByTestId("farm-list");
  await expect(farmList).toBeVisible(); // Visible, not just defined
  await expect(farmList).toContainText("Farm A"); // Has data

  // If dashboard fails to load, test fails immediately with clear message ✅
});
```

## Isolation: Shared State vs Independent Tests

### ❌ Anti-Pattern: Test Dependencies

```typescript
// BAD: Tests that depend on each other
let createdFarmId: string; // Shared state 😞

test("can create a farm", async ({ page }) => {
  await page.goto("/farms/new");
  await page.getByLabel("Farm Name").fill("Test Farm");
  await page.getByRole("button", { name: "Create" }).click();

  // Extracting data from the page (brittle!)
  const farmElement = await page.getByTestId("farm-created");
  createdFarmId = await farmElement.getAttribute("data-farm-id");
});

test("can update the farm", async ({ page }) => {
  // This test REQUIRES the previous test to run first! ❌
  if (!createdFarmId) throw new Error("Setup failed");

  await page.goto(`/farms/${createdFarmId}/edit`);
  // ...
});

test("can delete the farm", async ({ page }) => {
  // Another test that depends on setup ❌
  // Tests must run in specific order - violates isolation principle
});
```

### ✅ Correct Pattern: Independent Tests

```typescript
// GOOD: Each test is self-contained
test("can create a farm", async ({ page }) => {
  const scenario = testFarmScenario().build();

  // Fresh scenario for each test
  await page.goto("/farms/new");
  await page.getByLabel("Farm Name").fill(scenario.farm.name);
  await page.getByRole("button", { name: "Create" }).click();

  // Assert the result inline
  await expect(page).toHaveURL(/\/farms\/\d+$/);
});

test("can update a farm", async ({ page }) => {
  // This test doesn't depend on the previous one
  const scenario = testFarmScenario().build();

  // Assume the farm exists (mock/seed the backend)
  // Or create it within this test
  const farmId = await seedFarm(scenario.farm);

  await page.goto(`/farms/${farmId}/edit`);
  await page.getByLabel("Farm Name").fill("Updated Name");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page).toHaveURL(`/farms/${farmId}`);
});

test("can delete a farm", async ({ page }) => {
  // Also independent
  const scenario = testFarmScenario().build();
  const farmId = await seedFarm(scenario.farm);

  await page.goto(`/farms/${farmId}`);
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();

  await expect(page).toHaveURL("/farms");
});

// Run in any order - they all pass ✅
```

## Given-When-Then: Narrative vs Linear

### ❌ Anti-Pattern: Unclear Test Intent

```typescript
// BAD: Test intent is hard to follow
test("login flow", async ({ page }) => {
  await page.goto("/");

  // What are we setting up?
  const nationalId = "29901011234567";
  const password = "TestPassword123";

  // What action are we performing?
  await page.getByTestId("national-id-input").fill(nationalId);
  await page.getByTestId("password-input").fill(password);

  // What's the assertion testing?
  await page.getByTestId("login-submit").click();
  await page.waitForNavigation();

  // Is this success or failure? What role was the user?
  const urlAfterLogin = page.url();
  expect(urlAfterLogin).toContain("/dashboard");
});
```

### ✅ Correct Pattern: Given-When-Then

```typescript
// GOOD: Test intent is crystal clear
test("authorized farmer is redirected to their dashboard after login", async ({
  page,
}) => {
  const scenario = testLoginScenario().build();
  const loginPage = new LoginPage(page);

  // Given: the preconditions
  await test.step("Given a farmer arrives at the login page", async () => {
    await loginPage.goto("/");
  });

  // When: the action
  await test.step("When the farmer logs in with valid credentials", async () => {
    await loginPage.login(scenario.user.nationalId, scenario.user.password);
  });

  // Then: the assertion
  await test.step("Then they are redirected to their personal dashboard", async () => {
    await assertPage(page).navigatedTo(scenario.expectedPath);
  });
});

// Intent is obvious from the step names ✅
// Anyone can understand what this test validates
// Easy to add or remove steps
```

## Checkly Synthetic Checks: Monitoring Best Practices

### ❌ Anti-Pattern: Verbose, Hard-to-Maintain Checks

```typescript
// BAD: Check has too many assertions, no context
new ApiCheck("api-check-1", {
  name: "Users API",
  request: {
    url: "http://localhost:3000/api/users",
    method: "GET",
    assertions: [
      AssertionBuilder.statusCode().equals(200),
      AssertionBuilder.header("content-type").contains("text"),
      AssertionBuilder.body().contains("id"),
    ],
  },
});

// Problems:
// - No description (why does this matter?)
// - Hard-coded URL (won't work in production)
// - No SLA thresholds (is 5 seconds slow?)
// - No alert channels (who gets notified?)
// - No frequency (when does it run?)
```

### ✅ Correct Pattern: Purpose-Built Synthetic Checks

```typescript
// GOOD: Check has clear purpose and is properly configured
const BASE_URL = resolveBaseUrl(); // Environment-aware

new ApiCheck("aqwavalley-users-api-smoke", {
  name: "AqwaValley — Users API (smoke check)",
  description:
    "Validates that the users list API is available and responding " +
    "within SLA. This is a Tier 0 smoke check that runs after every deployment.",
  alertChannels: ALERT_CHANNELS, // From environment
  degradedResponseTime: 10000, // 10s warn, 20s critical
  maxResponseTime: 20000,
  frequency: 10, // Run every 10 minutes
  request: {
    url: `${BASE_URL}/api/users`, // Environment-based
    method: "GET",
    assertions: [
      AssertionBuilder.statusCode().equals(200), // Clear intent
      AssertionBuilder.header("content-type").contains("application/json"),
    ],
  },
});

// Purpose-built for monitoring ✅
// Scales across environments
// Clear alerting policies
// Runs automatically
```

## Debugging: When Tests Fail

### Inspect Page State

```typescript
test("debug failing test", async ({ page }) => {
  await test.step("When I perform an action", async () => {
    // Use pause() to open DevTools and inspect
    await page.pause();

    // Once you understand the state, remove pause() and fix the test
    const button = page.getByTestId("submit");
    console.log(await button.isVisible()); // true/false
    console.log(await button.isEnabled()); // true/false
    console.log(await button.textContent()); // actual text
  });
});
```

### Capture Evidence

```typescript
test("screenshot on error", async ({ page }) => {
  try {
    await expect(page.getByTestId("success-message")).toBeVisible();
  } catch (error) {
    // Capture what the page actually shows
    await page.screenshot({ path: "failure-screenshot.png" });
    throw error;
  }
});
```

### Review Traces

```bash
# Run with trace to see full test execution
pnpm playwright test --trace on

# View trace in Playwright Inspector
npx playwright show-trace trace.zip
```

---

## Summary: Key Takeaways

| Principle      | Anti-Pattern                 | Pattern                           |
| -------------- | ---------------------------- | --------------------------------- |
| **DRY**        | Selectors scattered in tests | Centralized in POM                |
| **Data**       | Hard-coded values            | Builders with defaults            |
| **Waiting**    | setTimeout(500)              | Auto-waiting + expect()           |
| **Assertions** | expect(something > 100)      | expect(element).toHaveText(...)   |
| **Isolation**  | Shared state between tests   | Independent, self-contained tests |
| **Intent**     | Linear sequence of steps     | Given-When-Then narrative         |
| **Monitoring** | Hard-coded URLs              | Environment configuration         |

---

**Reference**: See [README.md](./README.md) for complete framework documentation.
