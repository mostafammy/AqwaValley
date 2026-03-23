import { db } from "~/server/db";
import { alerts, well } from "~/server/db/schema";
import { eq, desc, isNull, and } from "drizzle-orm";
import { Badge } from "~/app/_components/UI/Badge";
import { alertSeverityVariant, alertSeverityLabel } from "~/lib/utils";
import { CheckCircle } from "lucide-react";

const SEVERITY_ICONS: Record<string, { icon: string; color: string }> = {
  critical: { icon: "●", color: "#ef4444" },
  warning:  { icon: "●", color: "#f59e0b" },
  info:     { icon: "●", color: "#3b82f6" },
};

export async function WellAlerts({ wellId }: { wellId: string }) {
  const active = await db
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
    .where(
      and(
        eq(alerts.wellId, wellId),
        isNull(alerts.acknowledgedAt),
      )
    )
    .orderBy(desc(alerts.createdAt))
    .limit(10);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">تنبيهات البئر</h3>
        {active.length > 0 && (
          <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
            {active.length}
          </span>
        )}
      </div>

      {active.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <Badge variant="ok">لا توجد تنبيهات نشطة</Badge>
        </div>
      ) : (
        <div className="space-y-3">
          {active.map((alert) => (
            <div
              key={alert.id}
              className="flex gap-3 items-start border-b border-gray-100 pb-3 last:border-0"
            >
              <span 
                className="text-lg leading-none mt-0.5" 
                title={alertSeverityLabel(alert.severity)}
                style={{ color: SEVERITY_ICONS[alert.severity]?.color ?? "#6b7280" }}
              >
                {SEVERITY_ICONS[alert.severity]?.icon ?? "●"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold line-clamp-2">
                  {alert.message}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(alert.createdAt).toLocaleString("ar-EG")}
                </p>
              </div>
              <Badge
                variant={alertSeverityVariant(alert.severity)}
                className="shrink-0 text-[10px] font-bold"
              >
                {alertSeverityLabel(alert.severity)}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
