import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type BadgeVariant = "ok" | "warn" | "danger" | "info" | "gray" | "navy" | "gold"
type WellStatus = "active" | "inactive" | "maintenance" | "offline" | "restricted"
type AlertSeverity = "critical" | "warning" | "info"
type AlertType = "threshold_breach" | "anomaly" | "sensor_offline"

const WELL_STATUS_TO_BADGE: Record<WellStatus, BadgeVariant> = {
  active: "ok",
  inactive: "gray",
  maintenance: "warn",
  offline: "danger",
  restricted: "gold",
}

const WELL_STATUS_TO_COLOR: Record<WellStatus, string> = {
  active: "#0D9E7E",
  inactive: "#94A3B8",
  maintenance: "#F59E0B",
  offline: "#D94040",
  restricted: "#7C3AED",
}

const WELL_STATUS_TO_LABEL: Record<WellStatus, string> = {
  active: "نشط",
  inactive: "غير نشط",
  maintenance: "صيانة",
  offline: "متوقف",
  restricted: "مقيد",
}

const ALERT_SEVERITY_TO_BADGE: Record<AlertSeverity, BadgeVariant> = {
  critical: "danger",
  warning: "warn",
  info: "info",
}

const ALERT_SEVERITY_TO_LABEL: Record<AlertSeverity, string> = {
  critical: "حرج",
  warning: "تحذير",
  info: "تنبيه",
}

const ALERT_TYPE_TO_LABEL: Record<AlertType, string> = {
  threshold_breach: "تجاوز الحد",
  anomaly: "شذوذ",
  sensor_offline: "تعطل الحساس",
}

export function wellStatusVariant(status: string): BadgeVariant {
  return WELL_STATUS_TO_BADGE[status as WellStatus] ?? "gray"
}

export function wellStatusColor(status: string): string {
  return WELL_STATUS_TO_COLOR[status as WellStatus] ?? "#94A3B8"
}

export function wellStatusLabel(status: string): string {
  return WELL_STATUS_TO_LABEL[status as WellStatus] ?? "غير معروف"
}

export function alertSeverityVariant(severity: string): BadgeVariant {
  return ALERT_SEVERITY_TO_BADGE[severity as AlertSeverity] ?? "gray"
}

export function alertSeverityLabel(severity: string): string {
  return ALERT_SEVERITY_TO_LABEL[severity as AlertSeverity] ?? "غير معروف"
}

export function alertTypeLabel(type: string): string {
  return ALERT_TYPE_TO_LABEL[type as AlertType] ?? "غير معروف"
}

export function formatAlertMessage(message: string | null | undefined): string {
  if (!message) {
    return "لا توجد رسالة"
  }

  return String(message).trim() || "لا توجد رسالة"
}
