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
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

type ReportStatus =
  | "queued"
  | "processing"
  | "completed"
  | "partial_failed"
  | "failed"
  | "cancelled";

const STATUS_LABELS: Record<ReportStatus, string> = {
  queued:         "في الانتظار",
  processing:     "قيد المعالجة",
  completed:      "مكتمل",
  partial_failed: "فشل جزئي",
  failed:         "فشل",
  cancelled:      "ملغى",
};

const STATUS_VARIANTS: Record<ReportStatus, "ok" | "warn" | "danger" | "gray"> = {
  queued:         "warn",
  processing:     "warn",
  completed:      "ok",
  partial_failed: "danger",
  failed:         "danger",
  cancelled:      "gray",
};

const REPORT_TYPE_LABELS: Record<string, string> = {
  user_activity:            "نشاط المستخدمين",
  district_governance:      "حوكمة المركز",
  compliance:               "الامتثال",
  audit_trail:              "سجل التدقيق",
  monthly_governance_pack:  "حزمة الحوكمة الشهرية",
};

const REPORT_TYPE_VALUES = [
  "user_activity",
  "district_governance",
  "compliance",
  "audit_trail",
  "monthly_governance_pack",
] as const;

// ── Report Generator ──────────────────────────────────────────────────────────

function ReportGenerator() {
  const utils = api.useUtils();
  const [reportType, setReportType] = useState("");
  const [formats,    setFormats]    = useState<string[]>(["pdf"]);
  const [scopeType,  setScopeType]  = useState<"global" | "district">("global");
  const [feedback,   setFeedback]   = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const createMutation = api.reports.requestGeneration.useMutation({
    onSuccess: () => {
      setFeedback({ type: "success", msg: "تم تقديم طلب التقرير بنجاح" });
      setReportType("");
      setFormats(["pdf"]);
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
    createMutation.mutate({
      reportType:             reportType as typeof REPORT_TYPE_VALUES[number],
      formats:                formats as ("pdf" | "csv" | "xlsx")[],
      generationMode:         "strict",
      granularity:            "monthly",
      scope:                  { scopeType, districtId: undefined },
      parameterSchemaVersion: "report-params-v1",
      templateVersion:        "v1",
      policyVersion:          "policy-current",
      maskingRulesVersion:    "masking-current",
      snapshotId:             `manual-${Date.now()}`,
      snapshotType:           "logical",
      parameters:             {},
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-500" />
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
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">اختر نوع التقرير</option>
              {REPORT_TYPE_VALUES.map((type) => (
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
                  className={`
                    px-4 py-2 rounded-xl text-xs font-bold uppercase border transition-all
                    ${formats.includes(format)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-slate-50 text-slate-500 border-slate-200 hover:border-blue-300"
                    }
                  `}
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
                  className={`
                    flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all
                    ${scopeType === scope
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-slate-50 text-slate-500 border-slate-200 hover:border-blue-300"
                    }
                  `}
                >
                  {scope === "global" ? "عام" : "مركز معين"}
                </button>
              ))}
            </div>
          </div>

          {/* Feedback */}
          {feedback && (
            <div className={`
              rounded-xl p-3 text-sm font-medium flex items-center gap-2
              ${feedback.type === "error"
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }
            `}>
              {feedback.msg}
            </div>
          )}

          <Button
            type="submit"
            disabled={createMutation.isPending || !reportType}
            className="w-full py-3 rounded-xl font-semibold"
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
  jobId:   string;
  onClose: () => void;
}) {
  const { data, isLoading, error } = api.reports.getJob.useQuery({ reportJobId: jobId });
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm"
      onClick={handleBackdrop}
    >
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" />
            <span className="font-semibold text-navy">تفاصيل التقرير</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
                  { label: "نوع التقرير", value: REPORT_TYPE_LABELS[data.job.reportType] ?? data.job.reportType },
                  { label: "نطاق التقرير", value: data.job.scopeType === "global" ? "عام" : data.job.scopeType },
                  { label: "تاريخ الإنشاء",  value: new Date(data.job.createdAt).toLocaleDateString("ar-EG") },
                  { label: "تاريخ الإكمال",  value: data.job.completedAt ? new Date(data.job.completedAt).toLocaleDateString("ar-EG") : "—" },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      {item.label}
                    </div>
                    <div className="text-sm font-semibold text-navy">{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Status */}
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  الحالة
                </span>
                <Badge variant={STATUS_VARIANTS[data.job.status]} dot>
                  {STATUS_LABELS[data.job.status]}
                </Badge>
              </div>

              {/* Error */}
              {data.job.errorDetail && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3">
                  <div className="text-xs font-bold text-red-600 mb-1">خطأ</div>
                  <div className="text-sm text-red-700">{data.job.errorDetail}</div>
                </div>
              )}

              {/* Artifacts */}
              <div>
                <div className="text-sm font-semibold text-navy mb-2">الملفات</div>
                {data.artifacts.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
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
                          <span className="rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground uppercase">
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
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/80 disabled:opacity-50 transition-all"
                          >
                            <Download className="w-3.5 h-3.5" />
                            تحميل
                          </button>
                        ) : (
                          <Badge variant="warn" dot>جاري التحضير</Badge>
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
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50">
          <Button
            variant="secondary"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl"
          >
            إغلاق
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Reports Table ─────────────────────────────────────────────────────────────

function ReportsTable({ onViewReport }: { onViewReport: (jobId: string) => void }) {
  const [page,         setPage]         = useState(1);
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("all");
  const pageSize = 10;

  const { data, isLoading, error } = api.reports.listJobs.useQuery({
    page,
    pageSize,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const jobs       = data?.items ?? [];
  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  if (error) {
    return (
      <Card>
        <CardBody className="py-12 text-center">
          <p className="text-red-600 font-medium">تعذر تحميل قائمة التقارير</p>
          <p className="mt-1 text-sm text-slate-400">قد تكون قاعدة البيانات غير مُهيأة للتقارير</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <CardTitle>قائمة التقارير</CardTitle>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as ReportStatus | "all");
              setPage(1);
            }}
            className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">كل الحالات</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </CardHeader>

      {/* Mobile — Cards */}
      <div className="block sm:hidden divide-y divide-slate-100">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-4 space-y-2">
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
              className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => onViewReport(job.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-navy truncate">
                  {REPORT_TYPE_LABELS[job.reportType] ?? job.reportType}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {new Date(job.createdAt).toLocaleDateString("ar-EG")}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={STATUS_VARIANTS[job.status]} dot>
                  {STATUS_LABELS[job.status]}
                </Badge>
                <ChevronLeft className="w-4 h-4 text-slate-300" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop — Table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">المعرف</th>
              <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">النوع</th>
              <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">الحالة</th>
              <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">التاريخ</th>
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
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
                  لا توجد تقارير لعرضها
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr
                  key={job.id}
                  className="cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => onViewReport(job.id)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">
                    {job.id.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3 font-medium text-navy">
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
                      onClick={(e) => { e.stopPropagation(); onViewReport(job.id); }}
                      className="text-xs text-blue-600 font-semibold hover:underline"
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
        <CardFooter className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <span className="text-xs text-slate-400">
            {Math.min(page * pageSize, total)} من {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-slate-600">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
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
        <h1 className="text-2xl md:text-3xl font-bold text-navy">التقارير والنماذج</h1>
        <p className="mt-1 text-sm text-slate-500">إنشاء وإدارة التقارير والنماذج</p>
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