/**
 * APICheckHelper provides utilities for writing deterministic API synthetic checks.
 *
 * Synthetic checks validate the API from the outside using the same HTTP clients
 * that real users (or downstream clients) would use. This ensures that:
 * - Request/response contracts are stable
 * - Error handling is graceful
 * - Response times meet expectations
 * - Security headers are present
 *
 * Usage in Checkly API checks:
 *   const helper = new APICheckHelper("https://api.example.com");
 *   const response = await helper.get("/health");
 *   helper.assertStatus(response, 200);
 *   helper.assertHeader(response, "content-type", "application/json");
 */

export interface APIResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  json?: unknown;
  duration: number;
}

export class APICheckHelper {
  constructor(private baseUrl: string) {}

  /**
   * Perform a GET request and return the response with timing information.
   */
  async get(path: string, options?: RequestInit): Promise<APIResponse> {
    const url = new URL(path, this.baseUrl).toString();
    const startTime = Date.now();

    const response = await fetch(url, {
      method: "GET",
      ...options,
    });

    const duration = Date.now() - startTime;
    const body = await response.text();

    // Try to parse as JSON if content-type indicates it
    let json: unknown;
    try {
      if (response.headers.get("content-type")?.includes("application/json")) {
        json = JSON.parse(body);
      }
    } catch {
      // If parsing fails, json remains undefined
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body,
      json,
      duration,
    };
  }

  /**
   * Perform a POST request with a JSON body.
   */
  async post(
    path: string,
    payload: unknown,
    options?: RequestInit,
  ): Promise<APIResponse> {
    const url = new URL(path, this.baseUrl).toString();
    const startTime = Date.now();

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      body: JSON.stringify(payload),
      ...options,
    });

    const duration = Date.now() - startTime;
    const body = await response.text();

    let json: unknown;
    try {
      if (response.headers.get("content-type")?.includes("application/json")) {
        json = JSON.parse(body);
      }
    } catch {
      // If parsing fails, json remains undefined
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body,
      json,
      duration,
    };
  }

  /**
   * Assert that the response status code matches the expected value.
   * Throws immediately with a clear message if it doesn't match.
   */
  assertStatus(response: APIResponse, expectedStatus: number) {
    if (response.status !== expectedStatus) {
      throw new Error(
        `Expected status ${expectedStatus}, got ${response.status}. Body: ${response.body}`,
      );
    }
  }

  /**
   * Assert that a response header is present and has a specific value.
   */
  assertHeader(
    response: APIResponse,
    headerName: string,
    expectedValue: string,
  ) {
    const actualValue = response.headers[headerName.toLowerCase()];
    if (!actualValue) {
      throw new Error(`Expected header '${headerName}' not found in response.`);
    }
    if (!actualValue.includes(expectedValue)) {
      throw new Error(
        `Expected header '${headerName}' to include '${expectedValue}', got '${actualValue}'`,
      );
    }
  }

  /**
   * Assert that the response body is valid JSON and matches a shape.
   */
  assertJsonShape(response: APIResponse, requiredFields: string[]) {
    if (!response.json || typeof response.json !== "object") {
      throw new Error(`Expected JSON response, got: ${response.body}`);
    }

    const json = response.json as Record<string, unknown>;
    for (const field of requiredFields) {
      if (!(field in json)) {
        throw new Error(
          `Expected JSON field '${field}' not found. Available fields: ${Object.keys(json).join(", ")}`,
        );
      }
    }
  }

  /**
   * Assert that the response time is within an acceptable range.
   */
  assertResponseTime(response: APIResponse, maxMilliseconds: number) {
    if (response.duration > maxMilliseconds) {
      throw new Error(
        `Response took ${response.duration}ms, expected to complete within ${maxMilliseconds}ms`,
      );
    }
  }

  /**
   * Assert that security headers are present.
   */
  assertSecurityHeaders(response: APIResponse) {
    const requiredHeaders = [
      "x-content-type-options",
      "x-frame-options",
      "content-security-policy",
    ];

    for (const header of requiredHeaders) {
      if (!(header in response.headers)) {
        throw new Error(`Missing security header: ${header}`);
      }
    }
  }
}

/**
 * Factory function for creating API check helpers.
 */
export function apiCheck(baseUrl: string) {
  return new APICheckHelper(baseUrl);
}
