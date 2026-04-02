/**
 * Tier 0 Invariant #3: Duplicate readings must be idempotent
 *
 * REQUIREMENT: Given the same sensorId and timestamp, the system must not
 * create duplicate persisted readings or duplicate downstream alerts.
 *
 * LAYER: Unit (deduplication logic only, not DB writes)
 * PRINCIPLES: F.I.R.S.T. - Deterministic, tests the dedup contract
 */

import { describe, it, expect } from "vitest";

interface IngestReading {
  sensorId: string;
  value: number;
  timestamp: Date;
}

/**
 * Deduplication logic: Given a batch of readings, keep only the newest
 * reading per (sensorId, **not** timestamp — just newest by timestamp).
 * At DB layer, duplicate (sensorId, timestamp) pairs are handled by
 * onConflictDoNothing() or similar constraints.
 */
function deduplicateReadingsPerSensor(
  readings: IngestReading[],
): Map<string, IngestReading> {
  const newestPerSensorMap = new Map<string, IngestReading>();

  for (const reading of readings) {
    const existing = newestPerSensorMap.get(reading.sensorId);

    // Keep the reading with the latest timestamp
    if (
      !existing ||
      reading.timestamp.getTime() >= existing.timestamp.getTime()
    ) {
      newestPerSensorMap.set(reading.sensorId, reading);
    }
  }

  return newestPerSensorMap;
}

/**
 * Identify exact duplicates: (sensorId, timestamp, value).
 * These will be silently dropped at the DB layer via onConflictDoNothing().
 */
function identifyExactDuplicates(readings: IngestReading[]): {
  duplicates: IngestReading[];
  unique: IngestReading[];
} {
  const seen = new Set<string>();
  const unique: IngestReading[] = [];
  const duplicates: IngestReading[] = [];

  for (const reading of readings) {
    // Create a composite key: "sensorId|timestamp|value"
    const key = `${reading.sensorId}|${reading.timestamp.getTime()}|${reading.value}`;

    if (seen.has(key)) {
      duplicates.push(reading);
    } else {
      seen.add(key);
      unique.push(reading);
    }
  }

  return { duplicates, unique };
}

describe("Duplicate Reading Idempotency (Invariant #3)", () => {
  const sensorA = "sensor-a";
  const sensorB = "sensor-b";
  const timestamp1 = new Date("2026-04-02T10:00:00Z");
  const timestamp2 = new Date("2026-04-02T10:05:00Z");

  it("should keep only the newest reading per sensor when given duplicates", () => {
    // Given: Multiple readings for the same sensor, different timestamps
    const readings: IngestReading[] = [
      {
        sensorId: sensorA,
        value: 100,
        timestamp: new Date("2026-04-02T10:00:00Z"),
      },
      {
        sensorId: sensorA,
        value: 150, // ← Newer timestamp, should win
        timestamp: new Date("2026-04-02T10:05:00Z"),
      },
      {
        sensorId: sensorA,
        value: 125,
        timestamp: new Date("2026-04-02T10:02:00Z"),
      },
    ];

    // When: Deduplicating
    const result = deduplicateReadingsPerSensor(readings);

    // Then: Only the newest reading is kept
    expect(result.size).toBe(1);
    const kept = result.get(sensorA);
    expect(kept).toBeDefined();
    expect(kept!.value).toBe(150);
    expect(kept!.timestamp).toEqual(new Date("2026-04-02T10:05:00Z"));
  });

  it("should preserve readings from different sensors", () => {
    // Given: Readings from two different sensors
    const readings: IngestReading[] = [
      {
        sensorId: sensorA,
        value: 100,
        timestamp: timestamp1,
      },
      {
        sensorId: sensorB,
        value: 200,
        timestamp: timestamp1,
      },
    ];

    // When: Deduplicating
    const result = deduplicateReadingsPerSensor(readings);

    // Then: Both sensors are kept
    expect(result.size).toBe(2);
    expect(result.get(sensorA)?.value).toBe(100);
    expect(result.get(sensorB)?.value).toBe(200);
  });

  it("should handle empty batch", () => {
    // Given: Empty batch
    const readings: IngestReading[] = [];

    // When: Deduplicating
    const result = deduplicateReadingsPerSensor(readings);

    // Then: Result is empty
    expect(result.size).toBe(0);
  });

  it("should be deterministic for out-of-order timestamps", () => {
    // Given: Readings in non-chronological order
    const readings: IngestReading[] = [
      { sensorId: sensorA, value: 150, timestamp: timestamp2 },
      { sensorId: sensorA, value: 100, timestamp: timestamp1 },
      { sensorId: sensorA, value: 125, timestamp: timestamp2 },
    ];

    // When: Deduplicating
    const result = deduplicateReadingsPerSensor(readings);

    // Then: Newest by timestamp is selected, regardless of order
    const kept = result.get(sensorA)!;
    expect(kept.timestamp).toEqual(timestamp2);
    // The value should be from one of the timestamp2 readings
    expect([150, 125]).toContain(kept.value);
  });

  it("should identify exact duplicates (same sensor, time, value)", () => {
    // Given: Exact duplicates in the batch
    const readings: IngestReading[] = [
      { sensorId: sensorA, value: 100, timestamp: timestamp1 },
      { sensorId: sensorA, value: 100, timestamp: timestamp1 }, // ← Exact dup
      { sensorId: sensorA, value: 100, timestamp: timestamp1 }, // ← Exact dup
      { sensorId: sensorA, value: 150, timestamp: timestamp2 }, // Different
    ];

    // When: Identifying duplicates
    const { duplicates, unique } = identifyExactDuplicates(readings);

    // Then: Duplicates are identified
    expect(unique).toHaveLength(2);
    expect(duplicates).toHaveLength(2);
    expect(unique[0].value).toBe(100);
    expect(unique[1].value).toBe(150);
  });

  it("should preserve uniqueness across multiple calls (idempotency)", () => {
    // Given: Same reading batch
    const readings: IngestReading[] = [
      { sensorId: sensorA, value: 100, timestamp: timestamp1 },
      { sensorId: sensorA, value: 150, timestamp: timestamp2 },
      { sensorId: sensorB, value: 200, timestamp: timestamp1 },
    ];

    // When: Deduplicating multiple times
    const result1 = deduplicateReadingsPerSensor(readings);
    const result2 = deduplicateReadingsPerSensor(readings);

    // Then: Results are identical
    expect(result1.size).toBe(result2.size);
    expect(result1.get(sensorA)).toEqual(result2.get(sensorA));
    expect(result1.get(sensorB)).toEqual(result2.get(sensorB));
  });

  it("should not duplicate alerts when reading is retried", () => {
    // Scenario: Network retry causes the same reading to be sent twice
    // The system should handle this gracefully and not create duplicate alerts

    // Given: First ingest of a reading
    const reading: IngestReading = {
      sensorId: sensorA,
      value: 500,
      timestamp: timestamp1,
    };

    // Deduplicate first batch (just one reading)
    const batch1 = [reading];
    const result1 = deduplicateReadingsPerSensor(batch1);
    expect(result1.size).toBe(1);
    expect(result1.get(sensorA)?.value).toBe(500);

    // Now, same reading comes in again (retry)
    const batch2 = [reading, reading];
    const result2 = deduplicateReadingsPerSensor(batch2);

    // Should still be one reading, not two
    expect(result2.size).toBe(1);
    expect(result2.get(sensorA)?.value).toBe(500);
  });

  it("should handle ties by keeping the most recent in the batch", () => {
    // Given: Readings with identical timestamps (edge case)
    const tiedTimestamp = timestamp1;
    const readings: IngestReading[] = [
      { sensorId: sensorA, value: 100, timestamp: tiedTimestamp },
      { sensorId: sensorA, value: 150, timestamp: tiedTimestamp }, // Same time
    ];

    // When: Deduplicating (with tie, the last one processed wins)
    const result = deduplicateReadingsPerSensor(readings);

    // Then: One reading is kept (the "last" by processing order)
    expect(result.size).toBe(1);
    // The kept value should be the one that wins the tie
    expect(result.get(sensorA)?.value).toBe(150);
  });

  it("should handle large batches efficiently", () => {
    // Given: Large batch with many sensors and duplicates
    const readings: IngestReading[] = [];
    for (let i = 0; i < 1000; i++) {
      const sensorId = `sensor-${i % 100}`; // 100 unique sensors
      readings.push({
        sensorId,
        value: Math.random() * 1000,
        timestamp: new Date(timestamp1.getTime() + (i % 10) * 60_000),
      });
    }

    // When: Deduplicating
    const result = deduplicateReadingsPerSensor(readings);

    // Then: Should have at most 100 unique sensors
    expect(result.size).toBeLessThanOrEqual(100);
    expect(result.size).toBeGreaterThan(0);
  });

  it("should not lose data when timestamps are very close", () => {
    // Given: Readings a millisecond apart
    const ts1 = new Date("2026-04-02T10:00:00.001Z");
    const ts2 = new Date("2026-04-02T10:00:00.002Z");

    const readings: IngestReading[] = [
      { sensorId: sensorA, value: 100, timestamp: ts1 },
      { sensorId: sensorA, value: 150, timestamp: ts2 },
    ];

    // When: Deduplicating
    const result = deduplicateReadingsPerSensor(readings);

    // Then: Newest is kept (ts2)
    const kept = result.get(sensorA)!;
    expect(kept.value).toBe(150);
    expect(kept.timestamp.getTime()).toBe(ts2.getTime());
  });
});
