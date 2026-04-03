"use client";

import React, { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  CardFooter,
} from "~/app/_components/UI/Card";
import { Badge } from "~/app/_components/UI/Badge";
import { Button } from "~/app/_components/UI/Button";
import { Skeleton } from "~/app/_components/UI/Skeleton";
import {
  FileText,
  Download,
  X,
  ChevronRight,
  ChevronLeft,
  Filter,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── Constants ─────────────────────────────────────────────────────────────────

type ReportStatus =
  | "queued"
  | "processing"
  | "completed"
  | "partial_failed"
  | "failed"
  | "cancelled";

const STATUS_LABELS: Record<ReportStatus, string> = {
  queued: "في الانتظار",
  processing: "قيد المعالجة",
  completed: "مكتمل",
  partial_failed: "فشل جزئي",
  failed: "فشل",
  cancelled: "ملغى",
};

const STATUS_VARIANTS: Record<ReportStatus, "ok" | "warn" | "danger" | "gray"> =
  {
    queued: "warn",
    processing: "warn",
    completed: "ok",
    partial_failed: "danger",
    failed: "danger",
    cancelled: "gray",
  };

const REPORT_TYPE_LABELS: Record<string, string> = {
  user_activity: "نشاط المستخدمين",
  district_governance: "حوكمة المركز",
  compliance: "الامتثال",
  audit_trail: "سجل التدقيق",
  monthly_governance_pack: "حزمة الحوكمة الشهرية",
};

const REPORT_TYPE_VALUES = [
  "user_activity",
  "district_governance",
  "compliance",
  "audit_trail",
  "monthly_governance_pack",
] as const;

function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  required,
}: {
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
  placeholder: string;
  required?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Hidden input for native form validation if required
  return (
    <div className="relative w-full">
      {required && (
        <input
          type="text"
          value={value}
          onChange={() => undefined}
          required={required}
          className="pointer-events-none absolute bottom-0 left-1/2 h-0 w-0 opacity-0"
          tabIndex={-1}
        />
      )}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex w-full items-center justify-between rounded-[10px] border px-3 py-2.5 text-sm transition-all focus:ring-2 focus:ring-blue-500 focus:outline-none ${
          isOpen
            ? "border-blue-400 bg-blue-50/30 text-blue-900"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
        } ${!value ? "text-slate-400" : "font-medium"}`}
      >
        <span>
          {value
            ? (options.find((o) => o.value === value)?.label ?? value)
            : placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform duration-300 ${
            isOpen ? "rotate-180 text-blue-500" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 5, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 5, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="absolute top-full z-40 mt-1 max-h-60 w-full overflow-y-auto rounded-[14px] border border-slate-100 bg-white/95 p-1 shadow-xl backdrop-blur-xl"
            >
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                }}
                className={`w-full rounded-[10px] px-3 py-2.5 text-right text-sm transition-colors ${
                  value === ""
                    ? "bg-blue-50 font-bold text-blue-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                {placeholder}
              </button>
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full rounded-[10px] px-3 py-2.5 text-right text-sm transition-colors ${
                    value === opt.value
                      ? "bg-blue-50 font-bold text-blue-700"
                      : "font-medium text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Report Generator ──────────────────────────────────────────────────────────

function ReportGenerator() {
  const utils = api.useUtils();
  const { data: supportedReportTypes } =
    api.reports.getSupportedReportTypes.useQuery();
  const [reportType, setReportType] = useState("");
  const [formats, setFormats] = useState<string[]>(["pdf"]);
  const [scopeType, setScopeType] = useState<"global" | "district">("global");
  const [districtId, setDistrictId] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  const availableReportTypes =
    supportedReportTypes && supportedReportTypes.length > 0
      ? supportedReportTypes
      : REPORT_TYPE_VALUES;

  const createMutation = api.reports.requestGeneration.useMutation({
    onSuccess: () => {
      setFeedback({ type: "success", msg: "تم تقديم طلب التقرير بنجاح" });
      setReportType("");
      setFormats(["pdf"]);
      setDistrictId("");
      void utils.reports.listJobs.invalidate();
    },
    onError: (err) => {
      setFeedback({ type: "error", msg: err.message || "فشل في طلب التقرير" });
    },
  });

  const toggleFormat = (format: string) => {
    if (formats.includes(format)) {
      if (formats.length > 1) setFormats(formats.filter((f) => f !== format));
    } else {
      setFormats([...formats, format]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (scopeType === "district" && !districtId.trim()) {
      setFeedback({
        type: "error",
        msg: "يرجى إدخال معرف المركز عند اختيار نطاق مركز معين",
      });
      return;
    }

    createMutation.mutate({
      reportType: reportType as (typeof REPORT_TYPE_VALUES)[number],
      formats: formats as ("pdf" | "csv" | "xlsx")[],
      generationMode: "strict",
      granularity: "monthly",
      scope: {
        scopeType,
        districtId:
          scopeType === "district" ? districtId.trim() || undefined : undefined,
      },
      parameterSchemaVersion: "report-params-v1",
      templateVersion: "v1",
      policyVersion: "policy-current",
      maskingRulesVersion: "masking-current",
      snapshotId: `manual-${Date.now()}`,
      snapshotType: "logical",
      parameters: {},
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-500" />
          <CardTitle>إنشاء تقرير جديد</CardTitle>
        </div>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Report Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              نوع التقرير
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              required
              className="w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="" disabled>
                اختر نوع التقرير
              </option>
              {availableReportTypes.map((type) => (
                <option key={type} value={type}>
                  {REPORT_TYPE_LABELS[type] ?? type}
                </option>
              ))}
            </select>
          </div>

          {/* Formats */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              صيغة الملف
            </label>
            <div className="flex flex-wrap gap-2">
              {(["pdf", "csv", "xlsx"] as const).map((format) => (
                <button
                  key={format}
                  type="button"
                  onClick={() => toggleFormat(format)}
                  className={`rounded-xl border px-4 py-2 text-xs font-bold uppercase transition-all ${
                    formats.includes(format)
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-500 hover:border-blue-300"
                  } `}
                >
                  {format}
                </button>
              ))}
            </div>
          </div>

          {/* Scope */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              نطاق التقرير
            </label>
            <div className="flex gap-3">
              {(["global", "district"] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setScopeType(scope)}
                  className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-all ${
                    scopeType === scope
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-500 hover:border-blue-300"
                  } `}
                >
                  {scope === "global" ? "عام" : "مركز معين"}
                </button>
              ))}
            </div>
            {scopeType === "district" && (
              <input
                type="text"
                value={districtId}
                onChange={(e) => setDistrictId(e.target.value)}
                placeholder="معرّف المركز (UUID)"
                className="w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            )}
            {scopeType === "global" && (
              <p className="text-xs text-slate-500">
                ملاحظة: التقارير العامة تتطلب صلاحية admin أو auditor.
              </p>
            )}
          </div>

          {/* Feedback */}
          {feedback && (
            <div
              className={`flex items-center gap-2 rounded-xl p-3 text-sm font-medium ${
                feedback.type === "error"
                  ? "border border-red-200 bg-red-50 text-red-700"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-700"
              } `}
            >
              {feedback.msg}
            </div>
          )}

          <Button
            type="submit"
            disabled={
              createMutation.isPending ||
              !reportType ||
              (scopeType === "district" && !districtId.trim())
            }
            className="w-full rounded-xl py-3 font-semibold"
          >
            {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء التقرير"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

// ── Report Detail Modal ───────────────────────────────────────────────────────

function ReportDetailModal({
  jobId,
  onClose,
}: {
  jobId: string;
  onClose: () => void;
}) {
  const { data, isLoading, error } = api.reports.getJob.useQuery({
    reportJobId: jobId,
  });
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!downloadingId || !data) return;
    const artifact = data.artifacts.find((a) => a.id === downloadingId);
    if (artifact) window.open(`/api/reports/download/${artifact.id}`, "_blank");
    setDownloadingId(null);
  }, [downloadingId, data]);

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={handleBackdrop}
    >
      <div className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" />
            <span className="text-navy font-semibold">تفاصيل التقرير</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 transition-colors hover:bg-slate-200"
          >
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : error || !data ? (
            <div className="py-12 text-center text-red-500">
              فشل تحميل تفاصيل التقرير
            </div>
          ) : (
            <>
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "نوع التقرير",
                    value:
                      REPORT_TYPE_LABELS[data.job.reportType] ??
                      data.job.reportType,
                  },
                  {
                    label: "نطاق التقرير",
                    value:
                      data.job.scopeType === "global"
                        ? "عام"
                        : data.job.scopeType,
                  },
                  {
                    label: "تاريخ الإنشاء",
                    value: new Date(data.job.createdAt).toLocaleDateString(
                      "ar-EG",
                    ),
                  },
                  {
                    label: "تاريخ الإكمال",
                    value: data.job.completedAt
                      ? new Date(data.job.completedAt).toLocaleDateString(
                          "ar-EG",
                        )
                      : "—",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                  >
                    <div className="mb-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                      {item.label}
                    </div>
                    <div className="text-navy text-sm font-semibold">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Status */}
              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  الحالة
                </span>
                <Badge variant={STATUS_VARIANTS[data.job.status]} dot>
                  {STATUS_LABELS[data.job.status]}
                </Badge>
              </div>

              {/* Error */}
              {data.job.errorDetail && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                  <div className="mb-1 text-xs font-bold text-red-600">خطأ</div>
                  <div className="text-sm text-red-700">
                    {data.job.errorDetail}
                  </div>
                </div>
              )}

              {/* Artifacts */}
              <div>
                <div className="text-navy mb-2 text-sm font-semibold">
                  الملفات
                </div>
                {data.artifacts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400">
                    لا توجد ملفات جاهزة
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.artifacts.map((artifact) => (
                      <div
                        key={artifact.id}
                        className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="bg-primary text-primary-foreground rounded-lg px-2.5 py-1 text-xs font-bold uppercase">
                            {artifact.format}
                          </span>
                          {artifact.fileSizeBytes && (
                            <span className="text-xs text-slate-400">
                              {(artifact.fileSizeBytes / 1024).toFixed(1)} KB
                            </span>
                          )}
                        </div>
                        {artifact.status === "ready" ? (
                          <button
                            onClick={() => setDownloadingId(artifact.id)}
                            disabled={downloadingId !== null}
                            className="bg-primary hover:bg-primary/80 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all disabled:opacity-50"
                          >
                            <Download className="h-3.5 w-3.5" />
                            تحميل
                          </button>
                        ) : (
                          <Badge variant="warn" dot>
                            جاري التحضير
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-4">
          <Button
            variant="secondary"
            onClick={onClose}
            className="w-full rounded-xl py-2.5"
          >
            إغلاق
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Reports Table ─────────────────────────────────────────────────────────────

function ReportsTable({
  onViewReport,
}: {
  onViewReport: (jobId: string) => void;
}) {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("all");
  const pageSize = 10;

  const { data, isLoading, error } = api.reports.listJobs.useQuery({
    page,
    pageSize,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const jobs = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  if (error) {
    return (
      <Card>
        <CardBody className="py-12 text-center">
          <p className="font-medium text-red-600">تعذر تحميل قائمة التقارير</p>
          <p className="mt-1 text-sm text-slate-400">
            قد تكون قاعدة البيانات غير مُهيأة للتقارير
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <CardTitle>قائمة التقارير</CardTitle>
          </div>
          <div className="w-full sm:w-64">
            <CustomSelect
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val ? (val as ReportStatus | "all") : "all");
                setPage(1);
              }}
              placeholder="كل الحالات"
              options={[
                { value: "all", label: "كل الحالات" },
                ...Object.entries(STATUS_LABELS).map(([v, l]) => ({
                  value: v,
                  label: l,
                })),
              ]}
            />
          </div>
        </div>
      </CardHeader>

      {/* Mobile — Cards */}
      <div className="block divide-y divide-slate-100 sm:hidden">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2 p-4">
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-4 w-1/2 rounded" />
            </div>
          ))
        ) : jobs.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            لا توجد تقارير لعرضها
          </div>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              className="flex cursor-pointer items-center justify-between gap-3 p-4 transition-colors hover:bg-slate-50"
              onClick={() => onViewReport(job.id)}
            >
              <div className="min-w-0 flex-1">
                <div className="text-navy truncate text-sm font-semibold">
                  {REPORT_TYPE_LABELS[job.reportType] ?? job.reportType}
                </div>
                <div className="mt-0.5 text-xs text-slate-400">
                  {new Date(job.createdAt).toLocaleDateString("ar-EG")}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={STATUS_VARIANTS[job.status]} dot>
                  {STATUS_LABELS[job.status]}
                </Badge>
                <ChevronLeft className="h-4 w-4 text-slate-300" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop — Table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-4 py-3 text-xs font-medium tracking-wider text-slate-500 uppercase">
                المعرف
              </th>
              <th className="px-4 py-3 text-xs font-medium tracking-wider text-slate-500 uppercase">
                النوع
              </th>
              <th className="px-4 py-3 text-xs font-medium tracking-wider text-slate-500 uppercase">
                الحالة
              </th>
              <th className="px-4 py-3 text-xs font-medium tracking-wider text-slate-500 uppercase">
                التاريخ
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-4 rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : jobs.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-sm text-slate-400"
                >
                  لا توجد تقارير لعرضها
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr
                  key={job.id}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                  onClick={() => onViewReport(job.id)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">
                    {job.id.slice(0, 8)}...
                  </td>
                  <td className="text-navy px-4 py-3 font-medium">
                    {REPORT_TYPE_LABELS[job.reportType] ?? job.reportType}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANTS[job.status]} dot>
                      {STATUS_LABELS[job.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {new Date(job.createdAt).toLocaleDateString("ar-EG")}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewReport(job.id);
                      }}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      عرض
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <CardFooter className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
          <span className="text-xs text-slate-400">
            {Math.min(page * pageSize, total)} من {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 transition-all hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium text-slate-600">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 transition-all hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

export function ReportsClient() {
  const [viewingReportId, setViewingReportId] = useState<string | null>(null);

  return (
    <div
      className="space-y-4 p-4 md:p-6"
      dir="rtl"
      style={{ animation: "fadeSlideUp 0.4s ease-out both" }}
    >
      <div>
        <h1 className="text-navy text-2xl font-bold md:text-3xl">
          التقارير والنماذج
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          إنشاء وإدارة التقارير والنماذج
        </p>
      </div>

      <div className="space-y-4">
        <ReportGenerator />
        <ReportsTable onViewReport={setViewingReportId} />
      </div>

      {viewingReportId && (
        <ReportDetailModal
          jobId={viewingReportId}
          onClose={() => setViewingReportId(null)}
        />
      )}
    </div>
  );
}
