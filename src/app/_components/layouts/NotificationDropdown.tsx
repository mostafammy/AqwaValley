"use client";

import { useRef, useEffect } from "react";
import { Bell, Check, AlertTriangle, Info, ChevronLeft } from "lucide-react";
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";
import { formatAlertMessage } from "~/lib/utils";

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

const SEVERITY_ICONS = {
  critical: <AlertTriangle className="h-4 w-4 text-red-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  info: <Info className="h-4 w-4 text-blue-500" />,
};

const SEVERITY_COLORS = {
  critical: "bg-red-50 border-red-100",
  warning: "bg-yellow-50 border-yellow-100",
  info: "bg-blue-50 border-blue-100",
};

export function NotificationDropdown({
  isOpen,
  onClose,
  anchorRef,
}: NotificationDropdownProps) {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch recent alerts
  const { data, isLoading } = api.alerts.list.useQuery({
    acknowledged: false,
    page: 1,
    pageSize: 5,
  });

  // Acknowledge mutation
  const ackMutation = api.alerts.acknowledge.useMutation({
    onSuccess: () => {
      router.refresh();
    },
  });

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop for mobile */}
      <div 
        className="fixed inset-0 z-40 md:hidden"
        onClick={onClose}
      />
      
      {/* Dropdown */}
      <div
        ref={dropdownRef}
        className="absolute left-4 top-full mt-2 z-50 w-80 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-gray-600" />
            <h3 className="font-semibold text-gray-800">الإشعارات</h3>
          </div>
          {data && data.total > 0 && (
            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
              {data.total} غير مقروء
            </span>
          )}
        </div>

        {/* Notifications List */}
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="h-8 w-8 bg-gray-200 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : data?.items.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <CheckCircle className="h-10 w-10 mx-auto text-gray-300" />
              <p className="text-sm mt-2">لا توجد إشعارات جديدة</p>
            </div>
          ) : (
            data?.items.map((alert) => (
              <div
                key={alert.id}
                className={`p-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                  SEVERITY_COLORS[alert.severity] ?? ""
                }`}
              >
                <div className="flex gap-3">
                  <div className="shrink-0 mt-0.5">
                    {SEVERITY_ICONS[alert.severity] ?? SEVERITY_ICONS.info}
                  </div>
                <a href="/alerts" className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 line-clamp-2">
                    {formatAlertMessage(alert.message)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(alert.createdAt).toLocaleTimeString("ar-EG", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </a>
                  <button
                    onClick={() => ackMutation.mutate({ alertId: alert.id })}
                    className="shrink-0 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                    title="استلام"
                  >
                    <Check className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {data && data.total > 0 && (
          <div className="p-3 border-t border-gray-100 bg-gray-50">
            <a
              href="/alerts"
              onClick={onClose}
              className="flex items-center justify-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <span>عرض كل التنبيهات</span>
              <ChevronLeft className="h-4 w-4" />
            </a>
          </div>
        )}
      </div>
    </>
  );
}
