import { db } from "~/server/db";
import { alerts, well } from "~/server/db/schema";
import { eq, desc, isNull } from "drizzle-orm";
import { Badge } from "~/app/_components/UI/Badge";
import { alertSeverityVariant, alertSeverityLabel, formatAlertMessage } from "~/lib/utils";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

async function getActiveAlerts() {
  return db
    .select({
      id: alerts.id,
      type: alerts.type,
      severity: alerts.severity,
      message: alerts.message,
      wellName: well.name,
      wellId: alerts.wellId,
      createdAt: alerts.createdAt,
    })
    .from(alerts)
    .leftJoin(well, eq(well.id, alerts.wellId))
    .where(isNull(alerts.acknowledgedAt))
    .orderBy(desc(alerts.createdAt))
    .limit(5);
}

const SEVERITY_EMOJI: Record<string, string> = {
  critical: "🔴",
  warning: "🟡",
  info: "🔵",
};

export async function AlertsFeed() {
  const active = await getActiveAlerts();

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <Link
          href="/alerts"
          className="flex items-center gap-1 text-sm font-semibold hover:text-blue-600 transition-colors"
        >
          <span>🚨 التنبيهات النشطة</span>
        </Link>
        {active.length > 0 && (
          <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
            {active.length}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {active.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 py-8">
            <span className="text-3xl">✅</span>
            <span className="text-sm mt-2">لا توجد تنبيهات نشطة</span>
          </div>
        ) : (
          active.map((alert) => (
            <Link
              key={alert.id}
              href="/alerts"
              className="flex gap-3 items-start border-b border-gray-100 pb-2 last:border-0 hover:bg-gray-50 rounded p-2 -mx-2 transition-colors"
            >
              <span className="text-lg leading-none mt-0.5">
                {SEVERITY_EMOJI[alert.severity] ?? "⚪"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 line-clamp-2">
                  {formatAlertMessage(alert.message ?? "")}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500">
                    {alert.wellName ?? "بئر غير معروف"}
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="text-xs text-gray-400">
                    {new Date(alert.createdAt).toLocaleTimeString("ar-EG", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Badge
                  variant={alertSeverityVariant(alert.severity)}
                  dot
                  className="uppercase font-bold text-[9px]"
                >
                  {alertSeverityLabel(alert.severity)}
                </Badge>
              </div>
            </Link>
          ))
        )}
      </div>

      {active.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <Link
            href="/alerts"
            className="flex items-center justify-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <span>عرض كل التنبيهات</span>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
