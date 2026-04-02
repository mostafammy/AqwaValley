/**
 * TestDataBuilder provides factory methods for creating realistic test data.
 *
 * This pattern ensures:
 * - Consistency across test scenarios (same data shape everywhere)
 * - Minimal but realistic fixtures (only the fields that matter)
 * - Easy composition (build user + farm + quota together)
 * - Deterministic seeds (same inputs = same data = reproducible tests)
 *
 * All factories return a builder that supports method chaining, allowing
 * the test to customize only the fields it cares about:
 *
 *   const scenario = testDataBuilder()
 *     .withUser({ nationalId: "12345" })
 *     .withFarm("well-a")
 *     .build();
 */

export interface TestUser {
  nationalId: string;
  password: string;
  email: string;
  name: string;
  role: "farmer" | "admin" | "technician";
}

export interface TestFarm {
  id: string;
  name: string;
  districtId: string;
  quotaLimitLiters: number;
}

export interface TestLoginScenario {
  user: TestUser;
  farm: TestFarm;
  expectedPath: string;
  expectedHeading: string;
}

const DEFAULT_TEST_USER: TestUser = {
  nationalId: "29901011234567",
  password: "SecurePassword@123",
  email: "test.farmer@example.com",
  name: "فارع تجربة",
  role: "farmer",
};

const DEFAULT_TEST_FARM: TestFarm = {
  id: "farm-test-001",
  name: "مزرعة الاختبار",
  districtId: "district-001",
  quotaLimitLiters: 10000,
};

/**
 * Builder for test users with sensible defaults.
 * Use to create users with specific roles or credentials.
 */
export class TestUserBuilder {
  private user: TestUser = { ...DEFAULT_TEST_USER };

  withNationalId(nationalId: string) {
    this.user.nationalId = nationalId;
    return this;
  }

  withPassword(password: string) {
    this.user.password = password;
    return this;
  }

  withEmail(email: string) {
    this.user.email = email;
    return this;
  }

  withName(name: string) {
    this.user.name = name;
    return this;
  }

  withRole(role: TestUser["role"]) {
    this.user.role = role;
    return this;
  }

  build() {
    return { ...this.user };
  }
}

/**
 * Builder for test farms with sensible defaults.
 * Use to create farms with specific quota limits or districts.
 */
export class TestFarmBuilder {
  private farm: TestFarm = { ...DEFAULT_TEST_FARM };

  withId(id: string) {
    this.farm.id = id;
    return this;
  }

  withName(name: string) {
    this.farm.name = name;
    return this;
  }

  withDistrictId(districtId: string) {
    this.farm.districtId = districtId;
    return this;
  }

  withQuotaLimitLiters(liters: number) {
    this.farm.quotaLimitLiters = liters;
    return this;
  }

  build() {
    return { ...this.farm };
  }
}

/**
 * Builder for complete login scenarios.
 * Composes user + farm + expectations for a full Given-When-Then flow.
 */
export class TestLoginScenarioBuilder {
  private scenario: TestLoginScenario = {
    user: { ...DEFAULT_TEST_USER },
    farm: { ...DEFAULT_TEST_FARM },
    expectedPath: "/dashboard",
    expectedHeading: "لوحة التحكم",
  };

  withUser(userOverrides: Partial<TestUser>) {
    this.scenario.user = { ...this.scenario.user, ...userOverrides };
    return this;
  }

  withFarm(farmOverrides: Partial<TestFarm>) {
    this.scenario.farm = { ...this.scenario.farm, ...farmOverrides };
    return this;
  }

  asAdminUser() {
    this.scenario.user.role = "admin";
    this.scenario.expectedPath = "/admin/dashboard";
    this.scenario.expectedHeading = "لوحة إدارة النظام";
    return this;
  }

  asUnauthorizedUser() {
    // User exists but has no valid role assignment
    this.scenario.expectedPath = "/unauthorized";
    this.scenario.expectedHeading = "غير مصرح بالوصول";
    return this;
  }

  withExpectedPath(path: string) {
    this.scenario.expectedPath = path;
    return this;
  }

  withExpectedHeading(heading: string) {
    this.scenario.expectedHeading = heading;
    return this;
  }

  build() {
    return {
      user: { ...this.scenario.user },
      farm: { ...this.scenario.farm },
      expectedPath: this.scenario.expectedPath,
      expectedHeading: this.scenario.expectedHeading,
    };
  }
}

/**
 * Factory functions to instantiate builders with fluent API.
 */
export function testUser() {
  return new TestUserBuilder();
}

export function testFarm() {
  return new TestFarmBuilder();
}

export function testLoginScenario() {
  return new TestLoginScenarioBuilder();
}
