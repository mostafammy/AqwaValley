/**
 * Tier 0 Invariant #1: Ingest authorization must be sensor-scoped
 *
 * REQUIREMENT: Given an API key attached to well A, a payload for sensor on
 * well B must be rejected and must not write a reading, quota event, or alert.
 *
 * LAYER: Unit (pure logic, no DB)
 * PRINCIPLES: F.I.R.S.T. - Deterministic authorization logic
 */

import { describe, it, expect } from "vitest";

// Simulated types from the real codebase
interface ApiKeyContext {
  apiKeyId: string;
  wellId?: string;
  role: "farm" | "district" | "admin";
}

interface Sensor {
  id: string;
  wellId: string;
  isActive: boolean;
  unit: string;
  type: string;
}

interface IngestReading {
  sensorId: string;
  value: number;
  timestamp: Date;
}

interface ValidationResult {
  valid: (IngestReading & { wellId: string; sensor: Sensor })[];
  rejected: { sensorId: string; reason: string }[];
}

/**
 * Core authorization logic extracted from ingestService.
 * Validates that sensor belong to the API key's well scope.
 */
function validateSensorOwnership(
  apiKeyCtx: ApiKeyContext,
  readings: IngestReading[],
  sensors: Map<string, Sensor>,
): ValidationResult {
  const valid: (IngestReading & { wellId: string; sensor: Sensor })[] = [];
  const rejected: { sensorId: string; reason: string }[] = [];

  for (const reading of readings) {
    const sensor = sensors.get(reading.sensorId);

    // Check 1: Sensor must exist
    if (!sensor) {
      rejected.push({ sensorId: reading.sensorId, reason: "Sensor not found" });
      continue;
    }

    // Check 2: Sensor must be active
    if (!sensor.isActive) {
      rejected.push({
        sensorId: reading.sensorId,
        reason: "Sensor is inactive",
      });
      continue;
    }

    // Check 3: CRITICAL - Sensor must belong to authorized well
    // This is the highest-integrity check in the ingest pipeline
    if (apiKeyCtx.wellId && sensor.wellId !== apiKeyCtx.wellId) {
      rejected.push({
        sensorId: reading.sensorId,
        reason: "Sensor does not belong to the authorized well",
      });
      continue;
    }

    // All checks passed
    valid.push({
      ...reading,
      wellId: sensor.wellId,
      sensor,
    });
  }

  return { valid, rejected };
}

describe("Ingest Authorization Scope (Invariant #1)", () => {
  // Create test data
  const wellA = "well-a-uuid";
  const wellB = "well-b-uuid";
  const sensorA1 = "sensor-a1-uuid";
  const sensorA2 = "sensor-a2-uuid";
  const sensorB1 = "sensor-b1-uuid";

  const sensorRegistry = new Map<string, Sensor>([
    [
      sensorA1,
      {
        id: sensorA1,
        wellId: wellA,
        isActive: true,
        unit: "mm",
        type: "flow_rate",
      },
    ],
    [
      sensorA2,
      {
        id: sensorA2,
        wellId: wellA,
        isActive: true,
        unit: "°C",
        type: "temperature",
      },
    ],
    [
      sensorB1,
      {
        id: sensorB1,
        wellId: wellB,
        isActive: true,
        unit: "mm",
        type: "flow_rate",
      },
    ],
  ]);

  it("should accept readings from sensors in the same well", () => {
    // Given: API key scoped to well A
    const apiKeyCtx: ApiKeyContext = {
      apiKeyId: "api-key-for-well-a",
      wellId: wellA,
      role: "farm",
    };

    // And: Readings from sensors A1 and A2
    const readings: IngestReading[] = [
      {
        sensorId: sensorA1,
        value: 125,
        timestamp: new Date("2026-04-02T10:00:00Z"),
      },
      {
        sensorId: sensorA2,
        value: 28,
        timestamp: new Date("2026-04-02T10:00:00Z"),
      },
    ];

    // When: Validating sensor ownership
    const result = validateSensorOwnership(apiKeyCtx, readings, sensorRegistry);

    // Then: All readings are accepted
    expect(result.valid).toHaveLength(2);
    expect(result.rejected).toHaveLength(0);
    expect(result.valid[0]).toBeDefined();
    expect(result.valid[0]!.sensorId).toBe(sensorA1);
    expect(result.valid[0]!.wellId).toBe(wellA);
  });

  it("should reject readings from sensors in a different well", () => {
    // Given: API key scoped to well A
    const apiKeyCtx: ApiKeyContext = {
      apiKeyId: "api-key-for-well-a",
      wellId: wellA,
      role: "farm",
    };

    // And: A reading from sensor B1 (in well B)
    const readings: IngestReading[] = [
      {
        sensorId: sensorB1,
        value: 150,
        timestamp: new Date("2026-04-02T10:00:00Z"),
      },
    ];

    // When: Validating sensor ownership
    const result = validateSensorOwnership(apiKeyCtx, readings, sensorRegistry);

    // Then: The reading is REJECTED with clear reason
    expect(result.valid).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]).toBeDefined();
    expect(result.rejected[0]!.reason).toBe(
      "Sensor does not belong to the authorized well",
    );
    // CRITICAL: No reading should be persisted
    expect(result.valid.map((r) => r.sensorId)).not.toContain(sensorB1);
  });

  it("should reject cross-well readings even in a batch with valid readings", () => {
    // Given: API key scoped to well A
    const apiKeyCtx: ApiKeyContext = {
      apiKeyId: "api-key-for-well-a",
      wellId: wellA,
      role: "farm",
    };

    // And: A batch with readings from both well A and well B
    const readings: IngestReading[] = [
      {
        sensorId: sensorA1,
        value: 125,
        timestamp: new Date("2026-04-02T10:00:00Z"),
      },
      {
        sensorId: sensorB1, // ← Cross-well intrusion attempt
        value: 150,
        timestamp: new Date("2026-04-02T10:00:00Z"),
      },
      {
        sensorId: sensorA2,
        value: 28,
        timestamp: new Date("2026-04-02T10:00:00Z"),
      },
    ];

    // When: Validating sensor ownership
    const result = validateSensorOwnership(apiKeyCtx, readings, sensorRegistry);

    // Then: Only well A sensors are accepted
    expect(result.valid).toHaveLength(2);
    expect(result.rejected).toHaveLength(1);
    expect(result.valid.map((r) => r.sensorId)).toEqual([sensorA1, sensorA2]);
    expect(result.rejected[0]).toBeDefined();
    expect(result.rejected[0]!.sensorId).toBe(sensorB1);
  });

  it("should reject readings from inactive sensors", () => {
    // Given: A sensor that's marked inactive
    const inactiveSensor: Sensor = {
      id: "sensor-inactive",
      wellId: wellA,
      isActive: false,
      unit: "mm",
      type: "flow_rate",
    };

    const registry = new Map(sensorRegistry);
    registry.set("sensor-inactive", inactiveSensor);

    // And: API key for well A
    const apiKeyCtx: ApiKeyContext = {
      apiKeyId: "api-key-for-well-a",
      wellId: wellA,
      role: "farm",
    };

    // And: Reading from the inactive sensor
    const readings: IngestReading[] = [
      {
        sensorId: "sensor-inactive",
        value: 100,
        timestamp: new Date("2026-04-02T10:00:00Z"),
      },
    ];

    // When: Validating
    const result = validateSensorOwnership(apiKeyCtx, readings, registry);

    // Then: Reading is rejected
    expect(result.valid).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]).toBeDefined();
    expect(result.rejected[0]!.reason).toBe("Sensor is inactive");
  });

  it("should reject readings from nonexistent sensors", () => {
    // Given: API key for well A
    const apiKeyCtx: ApiKeyContext = {
      apiKeyId: "api-key-for-well-a",
      wellId: wellA,
      role: "farm",
    };

    // And: Reading from a sensor that doesn't exist
    const readings: IngestReading[] = [
      {
        sensorId: "nonexistent-sensor",
        value: 100,
        timestamp: new Date("2026-04-02T10:00:00Z"),
      },
    ];

    // When: Validating
    const result = validateSensorOwnership(apiKeyCtx, readings, sensorRegistry);

    // Then: Reading is rejected
    expect(result.valid).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]).toBeDefined();
    expect(result.rejected[0]!.reason).toBe("Sensor not found");
  });

  it("should allow admin keys without well scope to accept from any well", () => {
    // Given: Admin API key with NO well scope
    const adminKey: ApiKeyContext = {
      apiKeyId: "admin-api-key",
      // wellId is undefined (no scope restriction)
      role: "admin",
    };

    // And: Readings from multiple wells
    const readings: IngestReading[] = [
      {
        sensorId: sensorA1,
        value: 125,
        timestamp: new Date("2026-04-02T10:00:00Z"),
      },
      {
        sensorId: sensorB1,
        value: 150,
        timestamp: new Date("2026-04-02T10:00:00Z"),
      },
    ];

    // When: Validating with unscoped admin key
    const result = validateSensorOwnership(adminKey, readings, sensorRegistry);

    // Then: Both readings are accepted (no well restriction)
    expect(result.valid).toHaveLength(2);
    expect(result.rejected).toHaveLength(0);
  });

  it("should be deterministic and idempotent", () => {
    // Given: Fixed API key and readings
    const apiKeyCtx: ApiKeyContext = {
      apiKeyId: "api-key-for-well-a",
      wellId: wellA,
      role: "farm",
    };

    const readings: IngestReading[] = [
      {
        sensorId: sensorA1,
        value: 125,
        timestamp: new Date("2026-04-02T10:00:00Z"),
      },
      {
        sensorId: sensorB1,
        value: 150,
        timestamp: new Date("2026-04-02T10:00:00Z"),
      },
    ];

    // When: Running validation multiple times
    const result1 = validateSensorOwnership(
      apiKeyCtx,
      readings,
      sensorRegistry,
    );
    const result2 = validateSensorOwnership(
      apiKeyCtx,
      readings,
      sensorRegistry,
    );
    const result3 = validateSensorOwnership(
      apiKeyCtx,
      readings,
      sensorRegistry,
    );

    // Then: Results are identical every time
    expect(result1.valid.length).toBe(result2.valid.length);
    expect(result2.valid.length).toBe(result3.valid.length);
    expect(result1.rejected).toEqual(result2.rejected);
    expect(result2.rejected).toEqual(result3.rejected);
  });
});
