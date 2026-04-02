import { type Page, expect } from "@playwright/test";

/**
 * BasePageObject provides common page interaction patterns that inherit into specific POMs.
 *
 * This class implements:
 * - Automatic waiting for navigation and readiness
 * - Stable locator strategies (data-testid first, then accessible names)
 * - Built-in screenshot helpers for evidence
 * - Common assertion methods that fail fast with clear messages
 *
 * Inheritance allows each page to focus on its unique selectors and behaviors
 * without repeating boilerplate.
 */
export class BasePageObject {
  constructor(protected readonly page: Page) {}

  /**
   * Navigate to a path and wait for the page to be ready.
   * Uses the configured base URL from the environment.
   */
  async goto(path: string) {
    await this.page.goto(path);
    // Wait for the main content to be present before proceeding
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Take a screenshot with a stable name and store it in ./test-results/.
   * Useful for visual regression and evidence capture.
   */
  async screenshot(name: string, fullPage = false) {
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `test-results/${timestamp}-${name}`;
    await this.page.screenshot({ path: filename, fullPage });
  }

  /**
   * Assert that the page URL matches a pattern.
   * Fails immediately with a clear message if the URL is wrong.
   */
  async expectURL(pattern: RegExp | string) {
    const url = this.page.url();
    if (typeof pattern === "string") {
      expect(url).toBe(pattern);
    } else {
      expect(url).toMatch(pattern);
    }
  }

  /**
   * Assert that the page title matches a pattern.
   * Useful for basic page identity checks.
   */
  async expectTitle(pattern: RegExp | string) {
    await expect(this.page).toHaveTitle(pattern);
  }

  /**
   * Wait for a locator to be visible and stable before returning.
   * Ensures the element is in the DOM, visible, and ready to interact with.
   */
  async waitForElement(locator: ReturnType<Page["locator"]>) {
    await locator.waitFor({ state: "visible", timeout: 5000 });
    return locator;
  }

  /**
   * Fill an input with automatic clearing and auto-waiting.
   * Automatically waits for the input to be ready and clears before typing.
   */
  async fillInput(locator: ReturnType<Page["locator"]>, value: string) {
    await this.waitForElement(locator);
    await locator.clear();
    await locator.fill(value);
  }

  /**
   * Click a button or element with auto-waiting.
   * Waits for it to be visible and enabled before clicking.
   */
  async clickButton(locator: ReturnType<Page["locator"]>) {
    await this.waitForElement(locator);
    await locator.click();
  }

  /**
   * Assert that an element has specific text.
   * Uses exact matching by default; set `exact: false` for substring matching.
   */
  async expectText(locator: ReturnType<Page["locator"]>, text: string, exact = true) {
    await expect(locator).toHaveText(text, { exact });
  }

  /**
   * Assert that an element is visible.
   */
  async expectVisible(locator: ReturnType<Page["locator"]>) {
    await expect(locator).toBeVisible();
  }

  /**
   * Assert that an element is hidden.
   */
  async expectHidden(locator: ReturnType<Page["locator"]>) {
    await expect(locator).toBeHidden();
  }

  /**
   * Assert that an element has a specific attribute value.
   */
  async expectAttribute(
    locator: ReturnType<Page["locator"]>,
    attribute: string,
    value: string
  ) {
    await expect(locator).toHaveAttribute(attribute, value);
  }

  /**
   * Close the browser context and clean up after the test.
   * Call this in teardown for tests that need explicit cleanup.
   */
  async cleanup() {
    await this.page.close();
  }
}
