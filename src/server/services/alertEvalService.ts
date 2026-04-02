import { type InferSelectModel } from "drizzle-orm";
import { type alertRule, type alertSeverityEnum } from "~/server/db/schema";

type AlertRule = InferSelectModel<typeof alertRule>;

type SensorReading = {
  sensorId: string;
  wellId: string;
  value: number;
  type: string;
};

export type TriggeredAlert = {
  wellId: string;
  sensorId: string;
  alertRuleId: string;
  type: string;
  severity: (typeof alertSeverityEnum.enumValues)[number];
  message: string;
  value: number;
  threshold: number;
  createdByUserId: string;
};

function evaluateOperator(
  value: number,
  operator: string,
  threshold: number,
): boolean {
  switch (operator) {
    case "gt":
      return value > threshold;
    case "lt":
      return value < threshold;
    case "gte":
      return value >= threshold;
    case "lte":
      return value <= threshold;
    case "eq":
      return value === threshold;
    default:
      return false;
  }
}

/**
 * Pure function — evaluates a set of alert rules against a sensor reading.
 * Returns an array of TriggeredAlert objects for rules that matched.
 * Has no side effects; caller is responsible for persisting and suppression.
 */
export function evaluateRules(
  rules: AlertRule[],
  reading: SensorReading,
): TriggeredAlert[] {
  const triggered: TriggeredAlert[] = [];

  for (const rule of rules) {
    // Only evaluate active rules that match the sensor type
    if (!rule.isActive) continue;
    if (rule.sensorType !== reading.type) continue;

    const threshold = Number(rule.threshold);
    const matches = evaluateOperator(reading.value, rule.operator, threshold);

    if (matches) {
      triggered.push({
        wellId: reading.wellId,
        sensorId: reading.sensorId,
        alertRuleId: rule.id,
        type: "threshold_breach",
        severity: rule.severity,
        message: `${reading.type} value ${reading.value} ${rule.operator} ${threshold} (rule: ${rule.id})`,
        value: reading.value,
        threshold,
        createdByUserId: rule.createdByUserId,
      });
    }
  }

  return triggered;
}
