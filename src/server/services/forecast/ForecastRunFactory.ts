import type {
  ForecastRunDraft,
  ForecastRunTrigger,
  ForecastScopeType,
  ForecastTargetType,
} from "~/server/services/forecast/types";

function stableJoin(values: readonly string[]): string {
  return [...values].sort().join(",");
}

function toIsoDatePart(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export class ForecastRunFactory {
  public createRunKey(args: {
    date: Date;
    scopeType: ForecastScopeType;
    scopeIds: readonly string[];
    targetTypes: readonly ForecastTargetType[];
  }): string {
    const datePart = toIsoDatePart(args.date);
    return [
      "aquifer-forecast",
      datePart,
      args.scopeType,
      stableJoin(args.scopeIds),
      stableJoin(args.targetTypes),
    ].join(":");
  }

  public createRunDraft(args: {
    triggerType: ForecastRunTrigger;
    scopeType: ForecastScopeType;
    scopeIds: string[];
    targetTypes: ForecastTargetType[];
    now?: Date;
  }): ForecastRunDraft {
    const triggeredAt = args.now ?? new Date();
    const runKey = this.createRunKey({
      date: triggeredAt,
      scopeType: args.scopeType,
      scopeIds: args.scopeIds,
      targetTypes: args.targetTypes,
    });

    return {
      runKey,
      triggeredAt,
      triggerType: args.triggerType,
      scopeType: args.scopeType,
      scopeIds: [...args.scopeIds],
      targetTypes: [...args.targetTypes],
    };
  }
}
