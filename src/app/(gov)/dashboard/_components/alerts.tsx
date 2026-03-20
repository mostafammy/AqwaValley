import { db } from "~/server/db";
import { alerts, well } from "~/server/db/schema";
import { eq, desc, isNull } from "drizzle-orm";
import { Badge } from "~/app/_components/UI/Badge";
import { alertSeverityVariant } from "~/lib/utils";

async function getActiveAlerts() {
  return db
    .select({
      id:        alerts.id,
      type:      alerts.type,
      severity:  alerts.severity,
      message:   alerts.message,
      wellName:  well.name,
      createdAt: alerts.createdAt,
    })
    .from(alerts)
    .leftJoin(well, eq(well.id, alerts.wellId))
    .where(isNull(alerts.acknowledgedAt))   // open = not acknowledged
    .orderBy(desc(alerts.createdAt))
    .limit(5);
}

const SEVERITY_EMOJI: Record<string, string> = {
  critical: "🔴",
  warning:  "🟡",
  info:     "🔵",
};

// SEVERITY_COLOR mapping removed as we use Badge variants now

export async function AlertsFeed() {
  const active = await getActiveAlerts();

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold">🚨 التنبيهات النشطة</span>
        {active.length > 0 && (
          <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
            {active.length}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        {active.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 py-8">
            <span className="text-3xl">✅</span>
            <span className="text-sm mt-2">لا توجد تنبيهات نشطة</span>
          </div>
        ) : (
          active.map((alert) => (
            <div
              key={alert.id}
              className="flex gap-3 items-start border-b border-gray-100 pb-3 last:border-0"
            >
              <span className="text-lg leading-none mt-0.5">
                {SEVERITY_EMOJI[alert.severity] ?? "⚪"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold line-clamp-2">
                  {alert.message}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {alert.wellName} ·{" "}
                  {new Date(alert.createdAt).toLocaleTimeString("ar-EG")}
                </p>
              </div>
              <Badge variant={alertSeverityVariant(alert.severity)} dot className="shrink-0 uppercase font-bold text-[10px]">
                {alert.severity}
              </Badge>
            </div>
          ))
        )}
      </div>
    </div>
  );
}