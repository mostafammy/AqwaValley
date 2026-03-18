import { type ComponentProps } from "react";
import { type Badge } from "~/app/_components/UI/Badge";

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

export function alertTypeLabel(type: string): string {
  const map: Record<string, string> = {
    threshold_breach: "تجاوز حد",
    anomaly: "شذوذ",
    sensor_offline: "حساس غير متصل",
  };
  return map[type] ?? type;
}

/** @deprecated use alertSeverityVariant instead */
export function alertTypeVariant(type: string): BadgeVariant {
  return alertSeverityVariant(type);
}
