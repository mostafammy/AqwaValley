"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Filter, ChevronRight, CheckCircle } from "lucide-react";
import { api } from "~/trpc/react";
import { Button } from "~/app/_components/UI/Button";
import { Badge } from "~/app/_components/UI/Badge";
import {
  alertSeverityVariant,
  alertSeverityLabel,
  alertTypeLabel,
  formatAlertMessage,
} from "~/lib/utils";

type Severity = "critical" | "warning" | "info" | undefined;
type AckStatus = "all" | "open" | "acknowledged";

export function AlertsTable() {
  const router = useRouter();
  const utils = api.useContext();

  // Filters
  const [severity, setSeverity] = useState<Severity>(undefined);
  const [ackStatus, setAckStatus] = useState<AckStatus>("all");
  const [page, setPage] = useState(1);
  const [pendingAckId, setPendingAckId] = useState<string | null>(null);
  const pageSize = 15;

  // Build query params
  const acknowledged =
    ackStatus === "open" ? false : ackStatus === "acknowledged" ? true : undefined;

  // Fetch alerts
  const { data, isLoading } = api.alerts.list.useQuery({
    severity,
    acknowledged,
    page,
    pageSize,
  });

  // Acknowledge mutation
  const acknowledgeMutation = api.alerts.acknowledge.useMutation({
    onSuccess: () => {
      setPendingAckId(null);
      void utils.alerts.list.invalidate();
      void utils.alerts.count.invalidate(); // Refresh the count in sidebar/topbar
    },
    onError: () => {
      setPendingAckId(null);
    },
  });

  const handleAcknowledge = (alertId: string) => {
    setPendingAckId(alertId);
    acknowledgeMutation.mutate({ alertId });
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden min-w-md">
      {/* Filters Bar */}
      <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Filter className="h-4 w-4" />
          <span>تصفية:</span>
        </div>

        {/* Severity Filter */}
        <select
          value={severity ?? ""}
          onChange={(e) => {
            setSeverity(e.target.value as Severity || undefined);
            setPage(1);
          }}
          className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-blue focus:ring-1 focus:ring-blue"
        >
          <option value="">كل الدرجات</option>
          <option value="critical">حرج</option>
          <option value="warning">تحذير</option>
          <option value="info">تنبيه</option>
        </select>

        {/* Status Filter */}
        <select
          value={ackStatus}
          onChange={(e) => {
            setAckStatus(e.target.value as AckStatus);
            setPage(1);
          }}
          className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-blue focus:ring-1 focus:ring-blue"
        >
          <option value="all">الكل</option>
          <option value="open">مفتوحة</option>
          <option value="acknowledged">تم الاستلام</option>
        </select>

        {/* Results count */}
        {data && (
          <span className="text-sm text-gray-400 mr-auto">
            {data.total} تنبيه
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                الحالة
              </th>
              <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                الرسالة
              </th>
              <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                البئر
              </th>
              <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                الدرجة
              </th>
              <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                النوع
              </th>
              <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                التاريخ
              </th>
              <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                إجراء
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-4">
                    <div className="h-6 w-6 bg-gray-200 rounded-full" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-4 w-48 bg-gray-200 rounded" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-4 w-24 bg-gray-200 rounded" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-6 w-12 bg-gray-200 rounded-full" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-4 w-20 bg-gray-200 rounded" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-4 w-16 bg-gray-200 rounded" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-8 w-20 bg-gray-200 rounded" />
                  </td>
                </tr>
              ))
            ) : data?.items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center text-gray-400">
                    <CheckCircle className="h-10 w-10 text-gray-300 mb-3" />
                    <p className="text-sm">لا توجد تنبيهات</p>
                  </div>
                </td>
              </tr>
            ) : (
              data?.items.map((alert) => (
                <tr
                  key={alert.id}
                  className={`transition-colors hover:bg-gray-50 ${
                    !alert.acknowledgedAt ? "bg-red-50/30" : ""
                  }`}
                >
                  {/* Status Icon */}
                  <td className="px-4 py-4">
                    {!alert.acknowledgedAt ? (
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                      </span>
                    ) : (
                      <span className="text-green-500">✓</span>
                    )}
                  </td>

                  {/* Message */}
                  <td className="px-4 py-4">
                    <p className="text-sm font-medium text-gray-800 max-w-md">
                      {formatAlertMessage(alert.message)}
                    </p>
                  </td>

                  {/* Well Name */}
                  <td className="px-4 py-4">
                    <a
                      href={`/wells/${alert.wellId}`}
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                    >
                      عرض البئر
                      <ChevronRight className="h-3 w-3" />
                    </a>
                  </td>

                  {/* Severity */}
                  <td className="px-4 py-4">
                    <Badge
                      variant={alertSeverityVariant(alert.severity)}
                      dot
                      className="text-xs"
                    >
                      {alertSeverityLabel(alert.severity)}
                    </Badge>
                  </td>

                  {/* Type */}
                  <td className="px-4 py-4">
                    <span className="text-xs text-gray-500">
                      {alertTypeLabel(alert.type)}
                    </span>
                  </td>

                  {/* Created At */}
                  <td className="px-4 py-4">
                    <div className="text-xs text-gray-500">
                      <div>
                        {new Date(alert.createdAt).toLocaleDateString("ar-EG")}
                      </div>
                      <div className="text-gray-400">
                        {new Date(alert.createdAt).toLocaleTimeString("ar-EG", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-4">
                    {!alert.acknowledgedAt ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAcknowledge(alert.id)}
                        loading={pendingAckId === alert.id && acknowledgeMutation.isPending}
                        icon={<Check className="h-3 w-3" />}
                      >
                        استلام
                      </Button>
                    ) : (
                      <span className="text-xs text-gray-400">
                        تم الاستلام
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-gray-100 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            صفحة {page} من {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              السابق
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              التالي
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
