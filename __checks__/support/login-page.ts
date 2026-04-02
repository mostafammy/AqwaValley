import { type Page, expect } from "@playwright/test";
import type { LoginScenario } from "./login-scenario";
import { BasePageObject } from "./base-page";

/**
 * LoginPage encodes the selectors, navigation, and assertions for the login surface.
 *
 * This class models the physical elements of the login UI and provides methods
 * to interact with them in a way that makes sense to the business domain.
 *
 * Instead of writing:
 *   await page.getByTestId("national-id-input").fill("123");
 *   await page.getByTestId("login-submit").click();
 *
 * Write:
 *   await loginPage.fillNationalId("123");
 *   await loginPage.submit();
 *
 * When the UI changes, only this class needs updating.
 */
export class LoginPage extends BasePageObject {
  constructor(protected readonly page: Page) {
    super(page);
  }

  async goto(path = "/") {
    await this.page.goto(path);
  }

  card() {
    return this.page.getByTestId("login-card");
  }

  title() {
    return this.page.getByTestId("login-title");
  }

  subtitle() {
    return this.page.getByTestId("login-subtitle");
  }

  form() {
    return this.page.getByTestId("login-form");
  }

  nationalIdInput() {
    return this.page.getByTestId("national-id-input");
  }

  passwordInput() {
    return this.page.getByTestId("password-input");
  }

  submitButton() {
    return this.page.getByTestId("login-submit");
  }

  async expectLoaded(scenario: LoginScenario) {
    await expect(this.page).toHaveURL(scenario.path);
    await expect(this.page).toHaveTitle(scenario.titlePattern);
    await expect(this.card()).toBeVisible();
    await expect(this.title()).toHaveText(scenario.brandHeading);
    await expect(this.subtitle()).toHaveText(scenario.portalLabel);
  }

  async expectControls(scenario: LoginScenario) {
    await expect(this.form()).toBeVisible();
    await expect(this.nationalIdInput()).toHaveAttribute(
      "id",
      "national-id-input",
    );
    await expect(this.passwordInput()).toHaveAttribute("id", "password-input");
    await expect(this.nationalIdInput()).toHaveAttribute("required", "");
    await expect(this.passwordInput()).toHaveAttribute("required", "");
    await expect(this.page.getByLabel(scenario.nationalIdLabel)).toBeVisible();
    await expect(this.page.getByLabel(scenario.passwordLabel)).toBeVisible();
    await expect(this.submitButton()).toHaveText(scenario.submitLabel);
  }

  async screenshot(name: string) {
    await this.page.screenshot({ path: name });
  }

  /**
   * Fill the national ID input with auto-waiting and clearing.
   */
  async fillNationalId(nationalId: string) {
    await this.fillInput(this.nationalIdInput(), nationalId);
  }

  /**
   * Fill the password input with auto-waiting and clearing.
   */
  async fillPassword(password: string) {
    await this.fillInput(this.passwordInput(), password);
  }

  /**
   * Submit the login form and wait for navigation.
   */
  async submit() {
    await this.clickButton(this.submitButton());
    // Wait for the page to navigate after login attempts
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Perform a complete login flow with credentials.
   */
  async login(nationalId: string, password: string) {
    await this.fillNationalId(nationalId);
    await this.fillPassword(password);
    await this.submit();
  }

  /**
   * Assert that an error message is displayed on the login form.
   */
  async expectError(errorText: string) {
    const errorElement = this.page.getByText(errorText);
    await expect(errorElement).toBeVisible();
  }
}
