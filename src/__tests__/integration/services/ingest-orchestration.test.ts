import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

class QueryChain<T = Row[]> {
  constructor(private readonly result: T) {}

  from() {
    return this;
  }

  where() {
    return this;
  }

  orderBy() {
    return this;
  }

  limit() {
    return Promise.resolve(this.result);
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

function createIngestDbDouble(options: {
  sensorsResult: Row[];
  rulesResult?: Row[];
}) {
  const writes = {
    sensorDataInsertValues: [] as Row[],
    latestStateInsertValues: [] as Row[],
  };

  const selectQueue: Row[][] = [
    options.sensorsResult,
    options.rulesResult ?? [],
  ];

  const makeInsert = () => ({
    values: (values: Row[] | Row) => {
      const list = Array.isArray(values) ? values : [values];
      if (
        list.length > 0 &&
        Object.prototype.hasOwnProperty.call(list[0] ?? {}, "timestamp")
      ) {
        writes.sensorDataInsertValues.push(...list);
      } else {
        writes.latestStateInsertValues.push(...list);
      }

      return {
        onConflictDoNothing: async () => undefined,
        onConflictDoUpdate: async () => undefined,
      };
    },
  });

  const tx = {
    select: vi.fn(() => new QueryChain(selectQueue.shift() ?? [])),
    insert: vi.fn(() => makeInsert()),
  };

  const db = {
    select: vi.fn(() => new QueryChain(selectQueue.shift() ?? [])),
    insert: vi.fn(() => makeInsert()),
    transaction: vi.fn(async (callback: (trx: typeof tx) => Promise<void>) => {
      await callback(tx);
    }),
  };

  return { db, writes };
}

const { mockEvaluateRules, mockLogger, activeDbHolder } = vi.hoisted(() => ({
  mockEvaluateRules: vi.fn(() => []),
  mockLogger: { info: vi.fn() },
  activeDbHolder: { db: undefined as unknown },
}));

let activeDbDouble: ReturnType<typeof createIngestDbDouble>;

vi.mock("~/server/db", () => ({
  get db() {
    return activeDbHolder.db;
  },
}));

vi.mock("~/server/services/alertEvalService", () => ({
  evaluateRules: mockEvaluateRules,
}));

vi.mock("~/lib/logger", () => ({ logger: mockLogger }));

import {
  ingestReadings,
  type IngestReading,
} from "~/server/services/ingestService";

describe("Ingest orchestration service integration (Invariant #2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeReading(sensorId: string, index: number): IngestReading {
    return {
      sensorId,
      value: 100 + index,
      timestamp: new Date(Date.UTC(2026, 3, 2, 10, 0, index)),
    };
  }

  async function runBatch(batchSize: number) {
    const sensorId = "00000000-0000-0000-0000-000000000111";
    const wellId = "00000000-0000-0000-0000-000000000222";

    const readings = Array.from({ length: batchSize }, (_, i) =>
      makeReading(sensorId, i),
    );

    activeDbDouble = createIngestDbDouble({
      sensorsResult: [
        {
          id: sensorId,
          wellId,
          unit: "mm",
          type: "flow_rate",
          isActive: true,
        },
      ],
      rulesResult: [],
    });
    activeDbHolder.db = activeDbDouble.db;

    const result = await ingestReadings(
      { id: "api-k", name: "integration-test-key", wellId },
      readings,
    );

    return { result, writes: activeDbDouble.writes };
  }

  it("ingest_accepts_batch_49_without_off_by_one_regression", async () => {
    const { result, writes } = await runBatch(49);

    expect(result.accepted).toBe(49);
    expect(result.rejected).toBe(0);
    expect(writes.sensorDataInsertValues).toHaveLength(49);
  });

  it("ingest_accepts_batch_50_without_off_by_one_regression", async () => {
    const { result, writes } = await runBatch(50);

    expect(result.accepted).toBe(50);
    expect(result.rejected).toBe(0);
    expect(writes.sensorDataInsertValues).toHaveLength(50);
  });

  it("ingest_accepts_batch_51_without_truncation", async () => {
    const { result, writes } = await runBatch(51);

    expect(result.accepted).toBe(51);
    expect(result.rejected).toBe(0);
    expect(writes.sensorDataInsertValues).toHaveLength(51);
  });

  it("ingest_accepts_batch_1312_without_silent_drop", async () => {
    const { result, writes } = await runBatch(1312);

    expect(result.accepted).toBe(1312);
    expect(result.rejected).toBe(0);
    expect(writes.sensorDataInsertValues).toHaveLength(1312);
  });
});
