import { type ComponentProps } from "react";
import { type Badge } from "~/app/_components/UI/Badge";

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

export function wellStatusVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    active:      "ok",
    low:         "warn",
    critical:    "danger",
    maintenance: "gray",
    alert:       "danger",
  };
  return map[status] ?? "gray";
}

export function wellStatusLabel(status: string): string {
  const map: Record<string, string> = {
    active:      "نشط",
    low:         "منخفض",
    critical:    "حرج",
    maintenance: "صيانة",
    alert:       "تنبيه",
  };
  return map[status] ?? status;
}

export function alertTypeVariant(type: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    CRITICAL: "danger",
    WARNING:  "warn",
    INFO:     "info",
  };
  return map[type] ?? "info";
}