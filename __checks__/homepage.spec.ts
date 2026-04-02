import { test, expect } from "@playwright/test";
import { LoginPage, loginScenario, assertPage, assertForm } from "./support";

/**
 * Homepage Smoke Test
 *
 * Validates the login page renders with all expected controls and is ready for user interaction.
 * This is a Tier 0 smoke check that runs on every deployment.
 *
 * F.I.R.S.T. principles applied:
 * - Fast: loads the page once, makes targeted assertions
 * - Isolated: no dependencies on other tests or external systems
 * - Repeatable: uses deterministic selectors and stable expectations
 * - Self-checking: clear assertions that fail immediately if the page is broken
 * - Timely: runs early in CI before expensive integration tests
 */

const scenario = loginScenario().build();

test("renders the AqwaValley login surface with all controls stable", async ({
  page,
}) => {
  const loginPage = new LoginPage(page);

  await test.step("Given an anonymous visitor arrives at the login page", async () => {
    // Navigate to the root URL and wait for the page to stabilize
    await loginPage.goto(scenario.path);
  });

  await test.step("When the page loads", async () => {
    // Assert basic page identity
    await assertPage(page)
      .loadedWithURL(scenario.path)
      .loadedWithTitle(scenario.titlePattern)
      .containsText(scenario.brandHeading);
  });

  await test.step("Then the login card and title are visible", async () => {
    // Assert the card container exists
    await loginPage.expectLoaded(scenario);
  });

  await test.step("And all form controls are present and actionable", async () => {
    // Assert that inputs have stable IDs and are required
    await assertForm(page)
      .isVisible()
      .hasLabel(scenario.nationalIdLabel)
      .hasLabel(scenario.passwordLabel)
      .hasInput("national-id-input")
      .hasInput("password-input")
      .hasButton("login-submit", scenario.submitLabel);

    // Use the POM to assert form stability
    await loginPage.expectControls(scenario);
  });

  await test.step("And the page structure matches the expected layout", async () => {
    // Take a screenshot for visual regression and manual review
    await loginPage.screenshot("homepage-baseline.png");

    // Assert that key visual elements are where they should be
    await expect(loginPage.card()).toBeVisible();
    await expect(loginPage.form()).toBeVisible();
  });

  // Final assertion: the URL is still at the root
  await expect(page).toHaveURL(scenario.path);
});
