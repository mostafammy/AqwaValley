import { describe, expect, it, vi } from "vitest";

vi.mock("~/env", () => ({
  env: {
    QUOTA_WARNING_THRESHOLD_PCT: 60,
    QUOTA_CRITICAL_THRESHOLD_PCT: 80,
  },
}));

import { computeFarmQuotaDecision } from "~/server/services/quotaDecisionService";

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

function createQuotaDbDouble(options: {
  farmRecord?: Row[];
  executeConsumption?: number;
  baselineRows?: Row[];
  allocationTotal?: number;
  overrideRows?: Row[];
  existingBreachRows?: Row[];
}) {
  const selectQueue: Row[][] = [
    options.farmRecord ?? [],
    options.baselineRows ?? [],
    [{ total: options.allocationTotal ?? 100 }],
    options.overrideRows ?? [],
    options.existingBreachRows ?? [],
  ];

  const writes = {
    snapshotUpserts: [] as Row[],
    breachInserts: [] as Row[],
  };

  let executeCallCount = 0;

  const db = {
    select: () => new QueryChain(selectQueue.shift() ?? []),
    execute: async () => {
      // Distribute consumption across three execute() calls (sensor, events, sessions)
      // Return full consumption on first call, 0 on subsequent calls
      const consumption = executeCallCount === 0 ? (options.executeConsumption ?? 0) : 0;
      executeCallCount++;
      return [{ consumption }];
    },
    insert: () => ({
      values: (value: Row | Row[]) => {
        const list = Array.isArray(value) ? value : [value];
        if (
          list[0] &&
          Object.prototype.hasOwnProperty.call(list[0], "decisionReasons")
        ) {
          writes.snapshotUpserts.push(...list);
          return {
            onConflictDoUpdate: async () => undefined,
          };
        }

        writes.breachInserts.push(...list);
        return Promise.resolve(undefined);
      },
    }),
  };

  return { db, writes };
}

describe("Quota decision service integration (Phase 2)", () => {
  it("quota_hard_block_at_100_percent_plus_returns_exceeded_and_records_breach", async () => {
    const { db, writes } = createQuotaDbDouble({
      farmRecord: [
        {
          id: "00000000-0000-0000-0000-00000000f001",
          districtId: "00000000-0000-0000-0000-00000000d001",
          monthlyQuotaM3: "10000",
          annualQuotaM3: "120000",
        },
      ],
      executeConsumption: 10050,
      baselineRows: [{ consumptionM3: "9800" }],
      allocationTotal: 100,
      overrideRows: [],
      existingBreachRows: [],
    });

    const decision = await computeFarmQuotaDecision({
      db: db as never,
      farmId: "00000000-0000-0000-0000-00000000f001",
      periodType: "monthly",
      anchor: new Date("2026-04-02T10:00:00Z"),
      baselineWindow: 1,
    });

    expect(decision.rawState).toBe("exceeded");
    expect(decision.effectiveState).toBe("exceeded");
    expect(decision.utilizationPct).toBeGreaterThan(100);
    expect(writes.snapshotUpserts).toHaveLength(1);
    expect(writes.breachInserts).toHaveLength(1);
  });

  it("quota_override_changes_effective_state_while_preserving_raw_state", async () => {
    const { db, writes } = createQuotaDbDouble({
      farmRecord: [
        {
          id: "00000000-0000-0000-0000-00000000f002",
          districtId: "00000000-0000-0000-0000-00000000d001",
          monthlyQuotaM3: "10000",
          annualQuotaM3: "120000",
        },
      ],
      executeConsumption: 8500,
      baselineRows: [{ consumptionM3: "8200" }],
      allocationTotal: 100,
      overrideRows: [{ stateOverride: "ok" }],
      existingBreachRows: [],
    });

    const decision = await computeFarmQuotaDecision({
      db: db as never,
      farmId: "00000000-0000-0000-0000-00000000f002",
      periodType: "monthly",
      anchor: new Date("2026-04-02T10:00:00Z"),
      baselineWindow: 1,
    });

    expect(decision.rawState).toBe("critical");
    expect(decision.effectiveState).toBe("ok");
    expect(writes.snapshotUpserts).toHaveLength(1);
    expect(writes.breachInserts).toHaveLength(1);
  });

  it("quota_missing_or_zero_quota_returns_needs_review", async () => {
    const { db, writes } = createQuotaDbDouble({
      farmRecord: [
        {
          id: "00000000-0000-0000-0000-00000000f003",
          districtId: "00000000-0000-0000-0000-00000000d001",
          monthlyQuotaM3: "0",
          annualQuotaM3: "0",
        },
      ],
      executeConsumption: 100,
      baselineRows: [],
      allocationTotal: 100,
      overrideRows: [],
      existingBreachRows: [],
    });

    const decision = await computeFarmQuotaDecision({
      db: db as never,
      farmId: "00000000-0000-0000-0000-00000000f003",
      periodType: "monthly",
      anchor: new Date("2026-04-02T10:00:00Z"),
      baselineWindow: 1,
    });

    expect(decision.rawState).toBe("needs_review");
    expect(decision.reasons).toContain("missing_or_zero_quota");
    expect(writes.snapshotUpserts).toHaveLength(1);
    expect(writes.breachInserts).toHaveLength(0);
  });
});
