import { type ComponentProps } from "react";
import { type Badge } from "~/app/_components/UI/Badge";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";


type BadgeVariant = ComponentProps<typeof Badge>["variant"];

export function wellStatusVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    active: "ok",
    inactive: "gray",
    maintenance: "warn",
    offline: "danger",
    restricted: "navy",
  };
  return map[status] ?? "gray";
}

export function wellStatusColor(status: string): string {
  const map: Record<string, string> = {
    active: "var(--color-ok)",
    inactive: "var(--color-muted)",
    maintenance: "var(--color-warn)",
    offline: "var(--color-danger)",
    restricted: "var(--color-restricted)",
  };
  return map[status] ?? "var(--color-muted)";
}

export function wellStatusLabel(status: string): string {
  const map: Record<string, string> = {
    active: "نشط",
    inactive: "غير نشط",
    maintenance: "صيانة",
    offline: "غير متصل",
    restricted: "مقيد",
  };
  return map[status] ?? status;
}

export function alertSeverityVariant(severity: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    critical: "danger",
    warning: "warn",
    info: "info",
  };
  return map[severity] ?? "info";
}

export function alertSeverityLabel(severity: string): string {
  const map: Record<string, string> = {
    critical: "حرج",
    warning: "تحذير",
    info: "تنبيه",
  };
  return map[severity] ?? severity;
}

export function alertTypeLabel(type: string): string {
  const map: Record<string, string> = {
    threshold_breach: "تجاوز حد",
    anomaly: "شذوذ",
    sensor_offline: "حساس غير متصل",
  };
  return map[type] ?? type;
}

/**
 * Transforms raw alert messages into user-friendly Arabic text.
 * Handles messages like: "pressure value 5 gt 3.5 (rule: uuid)"
 */
export function formatAlertMessage(message: string): string {
  // If already in Arabic, return as is
  if (/[\u0600-\u06FF]/.test(message)) {
    return message;
  }

  // Parse technical messages
  // Pattern: "sensorType value X operator Y (rule: uuid)"
  const match = /^(\w+)_?\s*value\s*(\d+\.?\d*)\s*(gt|lt|gte|lte|eq)\s*(\d+\.?\d*)/i.exec(message);
  
  if (!match) {
    return message;
  }

  const sensorType = match[1]?.toLowerCase() ?? "";
  const value = match[2] ?? "";
  const operator = (match[3] ?? "").toLowerCase();
  const threshold = match[4] ?? "";
  
  // Sensor type labels
  const sensorLabels: Record<string, { name: string; unit: string }> = {
    water_level: { name: "منسوب المياه", unit: "%" },
    flow_rate: { name: "معدل التدفق", unit: "م³/س" },
    pressure: { name: "الضغط", unit: "بار" },
    temperature: { name: "درجة الحرارة", unit: "°م" },
    humidity: { name: "الرطوبة", unit: "%" },
  };
  
  const sensor = sensorLabels[sensorType] ?? { name: sensorType, unit: "" };

  // Operator labels
  const operatorLabels: Record<string, string> = {
    gt: "أعلى من",
    lt: "أقل من",
    gte: "أعلى من أو يساوي",
    lte: "أقل من أو يساوي",
    eq: "يساوي",
  };
  const opLabel = operatorLabels[operator] ?? operator;

  // Direction indicators
  const isHigh = operator === "gt" || operator === "gte";
  const isLow = operator === "lt" || operator === "lte";
  const isEq = operator === "eq";
  
  let direction: string;
  if (isHigh) {
    direction = "ارتفاع";
  } else if (isLow) {
    direction = "انخفاض";
  } else if (isEq) {
    direction = "ثبات";
  } else {
    direction = "تغيير";
  }

  // Build readable message
  return `${sensor.name}: ${direction} ${value}${sensor.unit} (${opLabel} الحد: ${threshold}${sensor.unit})`;
}

/** @deprecated use alertSeverityVariant instead */
export function alertTypeVariant(type: string): BadgeVariant {
  return alertSeverityVariant(type);
}


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}