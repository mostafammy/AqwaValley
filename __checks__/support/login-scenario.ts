export type LoginScenario = {
  path: string;
  titlePattern: RegExp;
  brandHeading: string;
  portalLabel: string;
  nationalIdLabel: string;
  passwordLabel: string;
  submitLabel: string;
  screenshotName: string;
};

const DEFAULT_LOGIN_SCENARIO: LoginScenario = {
  path: "/",
  titlePattern: /AqwaValley|أكوا الوادي/,
  brandHeading: "أكوا الوادي",
  portalLabel: "بوابة الدخول الموحدة",
  nationalIdLabel: "الرقم القومي",
  passwordLabel: "كلمة المرور",
  submitLabel: "تسجيل الدخول",
  screenshotName: "login-page.png",
};

export class LoginScenarioBuilder {
  private scenario: LoginScenario = { ...DEFAULT_LOGIN_SCENARIO };

  withPath(path: string) {
    this.scenario.path = path;
    return this;
  }

  withTitlePattern(titlePattern: RegExp) {
    this.scenario.titlePattern = titlePattern;
    return this;
  }

  withBrandHeading(brandHeading: string) {
    this.scenario.brandHeading = brandHeading;
    return this;
  }

  withPortalLabel(portalLabel: string) {
    this.scenario.portalLabel = portalLabel;
    return this;
  }

  withScreenshotName(screenshotName: string) {
    this.scenario.screenshotName = screenshotName;
    return this;
  }

  build() {
    return { ...this.scenario };
  }
}

export function loginScenario() {
  return new LoginScenarioBuilder();
}
