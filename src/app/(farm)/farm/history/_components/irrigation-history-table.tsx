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
      <CardBody className="pt-3">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm border-collapse min-w-[680px]">
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
                    <td className="py-4 pr-4">
                      {event.durationMinutes} دقيقة
                    </td>
                    <td className="py-4 pr-4 text-gray-600">
                      {event.startedAt
                        ? event.startedAt.toLocaleTimeString("ar-EG", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"
                      }
                    </td>
                    <td className="py-4 pr-4 text-gray-600">
                      {event.endedAt
                        ? event.endedAt.toLocaleTimeString("ar-EG", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"
                      }
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
                            : event.quotaDebitStatus === "PENDING"
                              ? "معلق"
                              : event.quotaDebitStatus}
                      </Badge>
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