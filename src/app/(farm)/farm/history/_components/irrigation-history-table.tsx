"use client";

import { ClipboardList, Eye } from "lucide-react";
import { Badge } from "~/app/_components/UI/Badge";
import { Button } from "~/app/_components/UI/Button";
import { Card, CardBody, CardHeader } from "~/app/_components/UI/Card";

type IrrigationEvent = {
  id: string;
  status: string;
  durationMinutes: number;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  quotaDebitStatus: string;
};

type IrrigationHistoryTableProps = {
  history: IrrigationEvent[];
};

const statusLabels: Record<string, string> = {
  REQUESTED: "مطلوب",
  QUEUED: "في الانتظار",
  RUNNING: "قيد التشغيل",
  COMPLETED: "مكتمل",
  CANCELLED: "ملغي",
  FAILED: "فشل",
  ACTIVATED: "مفعل",
  PENDING: "قيد الانتظار",
};

const statusVariants: Record<string, "ok" | "warn" | "danger" | "info" | "gray"> = {
  COMPLETED: "ok",
  RUNNING: "info",
  QUEUED: "warn",
  REQUESTED: "gray",
  CANCELLED: "warn",
  FAILED: "danger",
  ACTIVATED: "ok",
  PENDING: "gray",
};

export function IrrigationHistoryTable({ history }: IrrigationHistoryTableProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <ClipboardList className="h-5 w-5 text-blue-500 flex-shrink-0" />
          <span className="text-base font-semibold text-gray-800">سجل الجلسات</span>
        </div>
      </CardHeader>
      <CardBody className="pt-3 px-0 md:px-6">
        {/* Mobile card view */}
        <div className="md:hidden space-y-3 px-4">
          {history.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">
              لا توجد جلسات ري سابقة
            </div>
          ) : (
            history.map((event) => (
              <div
                key={event.id}
                className="border border-gray-200 rounded-lg p-4 space-y-2 bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">التاريخ</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {event.createdAt.toLocaleDateString("ar-EG", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">المدة</span>
                  <span className="text-sm text-gray-700">{event.durationMinutes} دقيقة</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">الحالة</span>
                  <Badge variant={statusVariants[event.status] || "gray"}>
                    {statusLabels[event.status] || event.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">الخصم</span>
                  <Badge
                    variant={
                      event.quotaDebitStatus === "COMPLETED" || event.quotaDebitStatus === "APPLIED"
                        ? "ok"
                        : event.quotaDebitStatus === "FAILED"
                          ? "danger"
                          : "warn"
                    }
                  >
                    {event.quotaDebitStatus === "COMPLETED" || event.quotaDebitStatus === "APPLIED"
                      ? "مكتمل"
                      : event.quotaDebitStatus === "FAILED"
                        ? "فشل"
                        : "قيد الانتظار"}
                  </Badge>
                </div>
                <div className="flex items-center justify-end pt-2 border-t border-gray-200">
                  <button
                    className="inline-flex items-center justify-center p-2 text-gray-500 hover:text-gray-700 hover:bg-white rounded transition-colors"
                    aria-label="عرض التفاصيل"
                    title="عرض التفاصيل"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop table view */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-right text-sm border-collapse">
            <thead className="border-b border-gray-100">
              <tr>
                <th className="pb-4 pr-4 font-medium text-gray-600 whitespace-nowrap">التاريخ</th>
                <th className="pb-4 pr-4 font-medium text-gray-600 whitespace-nowrap">المدة المخططة</th>
                <th className="pb-4 pr-4 font-medium text-gray-600 whitespace-nowrap">بدأ في</th>
                <th className="pb-4 pr-4 font-medium text-gray-600 whitespace-nowrap">انتهى في</th>
                <th className="pb-4 pr-4 font-medium text-gray-600 whitespace-nowrap">الحالة</th>
                <th className="pb-4 pr-4 font-medium text-gray-600 whitespace-nowrap">الخصم من الحصة</th>
                <th className="pb-4 pr-4 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    لا توجد جلسات ري سابقة
                  </td>
                </tr>
              ) : (
                history.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 pr-4 font-medium">
                      {event.createdAt.toLocaleDateString("ar-EG", {
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                    <td className="py-4 pr-4">{event.durationMinutes} دقيقة</td>
                    <td className="py-4 pr-4 text-gray-600">
                      {event.startedAt
                        ? event.startedAt.toLocaleTimeString("ar-EG", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="py-4 pr-4 text-gray-600">
                      {event.endedAt
                        ? event.endedAt.toLocaleTimeString("ar-EG", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="py-4 pr-4">
                      <Badge variant={statusVariants[event.status] || "gray"}>
                        {statusLabels[event.status] || event.status}
                      </Badge>
                    </td>
                    <td className="py-4 pr-4">
                      <Badge
                        variant={
                          event.quotaDebitStatus === "COMPLETED" || event.quotaDebitStatus === "APPLIED"
                            ? "ok"
                            : event.quotaDebitStatus === "FAILED"
                              ? "danger"
                              : "warn"
                        }
                      >
                        {event.quotaDebitStatus === "COMPLETED" || event.quotaDebitStatus === "APPLIED"
                        ? "مكتمل"
                          : event.quotaDebitStatus === "FAILED"
                            ? "فشل"
                            : "قيد الانتظار"}
                      </Badge>
                    </td>
                    <td className="py-4 pr-4 text-center">
                      <button
                        className="inline-flex items-center justify-center p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        aria-label="عرض التفاصيل"
                        title="عرض التفاصيل"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}