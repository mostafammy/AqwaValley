"use client";

import { motion } from "framer-motion";
import { ClipboardList, Eye } from "lucide-react";
import { Badge } from "~/app/_components/UI/Badge";
import { Card, CardBody, CardHeader } from "~/app/_components/UI/Card";
import { springs, tapFeedback } from "~/lib/motion";

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

const statusVariants: Record<
  string,
  "ok" | "warn" | "danger" | "info" | "gray"
> = {
  COMPLETED: "ok",
  RUNNING: "info",
  QUEUED: "warn",
  REQUESTED: "gray",
  CANCELLED: "warn",
  FAILED: "danger",
  ACTIVATED: "ok",
  PENDING: "gray",
};

export function IrrigationHistoryTable({
  history,
}: IrrigationHistoryTableProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <ClipboardList className="h-5 w-5 shrink-0 text-blue-500" />
          <span className="text-base font-semibold text-gray-800">
            سجل الجلسات
          </span>
        </div>
      </CardHeader>
      <CardBody className="px-0 pt-3 md:px-6">
        {/* Mobile card view */}
        <div className="space-y-3 px-4 md:hidden">
          {history.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              لا توجد جلسات ري سابقة
            </div>
          ) : (
            history.map((event) => (
              <div
                key={event.id}
                className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4 transition-colors hover:bg-gray-100"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">
                    التاريخ
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {event.createdAt.toLocaleDateString("ar-EG", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">
                    المدة
                  </span>
                  <span className="text-sm text-gray-700">
                    {event.durationMinutes} دقيقة
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">
                    الحالة
                  </span>
                  <Badge
                    variant={statusVariants[event.status] ?? "gray"}
                    className="badge-animate"
                  >
                    {statusLabels[event.status] ?? event.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">
                    الخصم
                  </span>
                  <Badge
                    variant={
                      event.quotaDebitStatus === "COMPLETED" ||
                      event.quotaDebitStatus === "APPLIED"
                        ? "ok"
                        : event.quotaDebitStatus === "FAILED"
                          ? "danger"
                          : "warn"
                    }
                    className="badge-animate"
                  >
                    {event.quotaDebitStatus === "COMPLETED" ||
                    event.quotaDebitStatus === "APPLIED"
                      ? "مكتمل"
                      : event.quotaDebitStatus === "FAILED"
                        ? "فشل"
                        : "قيد الانتظار"}
                  </Badge>
                </div>
                <div className="flex items-center justify-end border-t border-gray-200 pt-2">
                  <motion.button
                    whileTap={tapFeedback}
                    transition={springs.snappy}
                    className="inline-flex items-center justify-center rounded p-2 text-gray-500 transition-colors hover:bg-white hover:text-gray-700"
                    aria-label="عرض التفاصيل"
                    title="عرض التفاصيل"
                  >
                    <Eye className="h-4 w-4" />
                  </motion.button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop table view */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-collapse text-right text-sm">
            <thead className="glass-header border-b border-gray-100">
              <tr>
                <th className="pr-4 pb-4 font-medium whitespace-nowrap text-gray-600">
                  التاريخ
                </th>
                <th className="pr-4 pb-4 font-medium whitespace-nowrap text-gray-600">
                  المدة المخططة
                </th>
                <th className="pr-4 pb-4 font-medium whitespace-nowrap text-gray-600">
                  بدأ في
                </th>
                <th className="pr-4 pb-4 font-medium whitespace-nowrap text-gray-600">
                  انتهى في
                </th>
                <th className="pr-4 pb-4 font-medium whitespace-nowrap text-gray-600">
                  الحالة
                </th>
                <th className="pr-4 pb-4 font-medium whitespace-nowrap text-gray-600">
                  الخصم من الحصة
                </th>
                <th className="w-16 pr-4 pb-4"></th>
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
                history.map((event, index) => (
                  <motion.tr
                    key={event.id}
                    className="table-row-hover transition-colors hover:bg-gray-50"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springs.floaty, delay: index * 0.04 }}
                  >
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
                      <Badge
                        variant={statusVariants[event.status] ?? "gray"}
                        className="badge-animate"
                      >
                        {statusLabels[event.status] ?? event.status}
                      </Badge>
                    </td>
                    <td className="py-4 pr-4">
                      <Badge
                        variant={
                          event.quotaDebitStatus === "COMPLETED" ||
                          event.quotaDebitStatus === "APPLIED"
                            ? "ok"
                            : event.quotaDebitStatus === "FAILED"
                              ? "danger"
                              : "warn"
                        }
                          className="badge-animate"
                      >
                        {event.quotaDebitStatus === "COMPLETED" ||
                        event.quotaDebitStatus === "APPLIED"
                          ? "مكتمل"
                          : event.quotaDebitStatus === "FAILED"
                            ? "فشل"
                            : "قيد الانتظار"}
                      </Badge>
                    </td>
                    <td className="py-4 pr-4 text-center">
                      <motion.button
                        whileTap={tapFeedback}
                        transition={springs.snappy}
                        className="inline-flex items-center justify-center rounded p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
                        aria-label="عرض التفاصيل"
                        title="عرض التفاصيل"
                      >
                        <Eye className="h-4 w-4" />
                      </motion.button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
