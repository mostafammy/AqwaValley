/**
 * AssertionHelpers provides reusable assertion patterns for BDD-style test steps.
 *
 * These helpers wrap Playwright expect statements with better error messages
 * and clearer intent, making test failures easier to diagnose.
 *
 * Usage in test steps:
 *   await test.step("Then the form is ready", async () => {
 *     await assertForm(page).isVisible().hasLabel("Email");
 *   });
 */

import { type Page, expect } from "@playwright/test";

export class FormAssertions {
  constructor(private page: Page) {}

  async isVisible() {
    // Assert that a form exists and is visible
    const form = this.page.locator("form");
    await expect(form).toBeVisible();
    return this;
  }

  async hasLabel(labelText: string) {
    const label = this.page.getByLabel(labelText);
    await expect(label).toBeVisible();
    return this;
  }

  async hasInput(testId: string) {
    const input = this.page.getByTestId(testId);
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute("required", "");
    return this;
  }

  async hasButton(testId: string, text?: string) {
    const button = this.page.getByTestId(testId);
    await expect(button).toBeVisible();
    if (text) {
      await expect(button).toHaveText(text);
    }
    return this;
  }

  async hasError(errorText: string) {
    const errorDiv = this.page.getByText(errorText);
    await expect(errorDiv).toBeVisible();
    return this;
  }
}

export class PageAssertions {
  constructor(private page: Page) {}

  async loadedWithTitle(titlePattern: RegExp | string) {
    if (typeof titlePattern === "string") {
      await expect(this.page).toHaveTitle(titlePattern);
    } else {
      await expect(this.page).toHaveTitle(titlePattern);
    }
    return this;
  }

  async loadedWithURL(urlPattern: RegExp | string) {
    if (typeof urlPattern === "string") {
      await expect(this.page).toHaveURL(urlPattern);
    } else {
      await expect(this.page).toHaveURL(urlPattern);
    }
    return this;
  }

  async containsText(text: string) {
    await expect(this.page.getByText(text)).toBeVisible();
    return this;
  }

  async navigatedTo(path: string) {
    await expect(this.page).toHaveURL(path);
    return this;
  }
}

/**
 * Factory functions for assertion helpers that read more naturally in tests:
 *
 *   await assertForm(page).isVisible().hasLabel("Email").hasButton("submit");
 *   await assertPage(page).loadedWithTitle("Dashboard").containsText("Welcome");
 */
export function assertForm(page: Page) {
  return new FormAssertions(page);
}

export function assertPage(page: Page) {
  return new PageAssertions(page);
}

/**
 * Assertion helper for API responses and status codes.
 * Use in API checks to assert on response properties.
 */
export function assertResponse(status: number, expectedStatus: number) {
  try {
    expect(status).toBe(expectedStatus);
  } catch (e) {
    throw new Error(`Expected status ${expectedStatus}, got ${status}`);
  }
}

/**
 * Assertion helper for JSON response bodies.
 * Use to assert that API responses contain expected fields.
 */
export function assertJsonResponse(body: unknown, expectedFields: string[]) {
  expect(body).toBeDefined();
  const json = body as Record<string, unknown>;
  for (const field of expectedFields) {
    expect(json[field]).toBeDefined();
  }
}
