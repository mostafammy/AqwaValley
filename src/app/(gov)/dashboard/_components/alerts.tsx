import { db } from "~/server/db";
import { alerts, well } from "~/server/db/schema";
import { eq, desc, isNull } from "drizzle-orm";
import { Badge } from "~/app/_components/UI/Badge";
import {
  alertSeverityVariant,
  alertSeverityLabel,
  formatAlertMessage,
} from "~/lib/utils";
import Link from "next/link";
import { ChevronLeft, BellRing } from "lucide-react";

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

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-[#FF3B30] shadow-[0_0_8px_rgba(255,59,48,0.4)] border-[#FF3B30]",
  warning: "bg-orange-500 shadow-orange-500/40 border-orange-200",
  info: "bg-blue-500 shadow-blue-500/40 border-blue-200",
};

export async function AlertsFeed() {
  const active = await getActiveAlerts();

  return (
    <div className={`group relative flex flex-col overflow-hidden rounded-[2rem] bg-white p-5 border border-[#E5E5EA] transition-colors duration-500 hover:border-slate-300 md:p-6 ${active.length === 0 ? "min-h-[120px]" : "h-full"}`}>
      <div className="absolute -top-20 -left-20 z-0 h-40 w-40 rounded-full bg-rose-50 opacity-0 mix-blend-multiply blur-3xl transition-opacity duration-500 group-hover:opacity-100" />

      <div className="relative z-10 mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
        <Link
          href="/alerts"
          className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-slate-800 transition-colors hover:text-blue-600"
        >
          <BellRing className="h-5 w-5" strokeWidth={2.5} />
          <span>التنبيهات النشطة</span>
        </Link>
        {active.length > 0 && (
          <span className="flex h-6 items-center justify-center rounded-full bg-[#FF3B30] px-2.5 text-xs font-black text-white shadow-sm ring-1 ring-[#FF3B30]/50">
            {active.length}
          </span>
        )}
      </div>

      <div className="relative z-10 flex-1 space-y-3 overflow-y-auto">
        {active.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 gap-3">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-emerald-400 opacity-80">
              <path d="M24 4C24 4 10 18 10 28a14 14 0 0028 0C38 18 24 4 24 4z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" />
              <path d="M18 28l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="flex flex-col items-center">
              <span className="text-[13px] font-semibold text-slate-400">
                لا توجد تنبيهات نشطة
              </span>
              <span className="text-[11px] text-slate-300">
                جميع الأنظمة تعمل بشكل طبيعي
              </span>
            </div>
          </div>
        ) : (
          active.map((alert) => (
            <Link
              key={alert.id}
              href="/alerts"
              className="group/alert block rounded-2xl border border-transparent p-3 transition-all hover:border-slate-200 hover:bg-slate-50 active:scale-[0.98]"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full shadow-sm ${SEVERITY_COLORS[alert.severity] ?? "bg-slate-400"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm leading-relaxed font-bold text-slate-800 transition-colors group-hover/alert:text-blue-700">
                    {formatAlertMessage(alert.message ?? "")}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-slate-100 bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 shadow-sm">
                      {alert.wellName ?? "بئر غير معروف"}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs font-semibold text-slate-400">
                      {new Date(alert.createdAt).toLocaleTimeString("ar-EG", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge
                    variant={alertSeverityVariant(alert.severity)}
                    className="text-[10px] font-black tracking-wider uppercase"
                  >
                    {alertSeverityLabel(alert.severity)}
                  </Badge>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {active.length > 0 && (
        <div className="relative z-10 mt-4 border-t border-slate-100 pt-4">
          <Link
            href="/alerts"
            className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-50 py-2.5 text-sm font-bold text-blue-600 transition-colors hover:bg-blue-100 hover:text-blue-700"
          >
            <span>عرض كل التنبيهات</span>
            <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
          </Link>
        </div>
      )}
    </div>
  );
}
