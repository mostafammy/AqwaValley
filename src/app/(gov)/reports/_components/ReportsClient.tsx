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
  Trash2,
  Users,
  Building2,
  ShieldCheck,
  History,
  FileSpreadsheet,
  Calendar,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { springs, variants, tapFeedback } from "~/lib/motion";

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

const STATUS_VARIANTS: Record<ReportStatus, "ok" | "warn" | "danger" | "gray"> = {
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
  compliance: "الامتثال والتجاوزات",
  audit_trail: "سجل التدقيق والعمليات",
  monthly_governance_pack: "حزمة الحوكمة الشهرية",
};

const REPORT_TYPE_DESCRIPTIONS: Record<string, string> = {
  user_activity: "إحصائيات تفصيلية لعمليات الدخول واستخدام النظام والآبار",
  district_governance: "متابعة توزيع المياه والحصص المقررة في المراكز والمحافظات",
  compliance: "مراقبة تجاوزات السحب والالتزام بالحصص المقررة للآبار",
  audit_trail: "تتبع جميع التغييرات والعمليات الحساسة في قاعدة البيانات للأمان",
  monthly_governance_pack: "حزمة التقارير الشهرية الشاملة لجميع العمليات والامتثال",
};

const REPORT_TYPE_ICONS: Record<string, React.ReactNode> = {
  user_activity: <Users className="h-5 w-5" />,
  district_governance: <Building2 className="h-5 w-5" />,
  compliance: <ShieldCheck className="h-5 w-5" />,
  audit_trail: <History className="h-5 w-5" />,
  monthly_governance_pack: <FileSpreadsheet className="h-5 w-5" />,
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
        className={`flex w-full items-center justify-between rounded-[10px] border px-4 py-2.5 text-sm transition-all focus:ring-2 focus:ring-blue-500/20 focus:outline-none ${
          isOpen
            ? "border-blue-400 bg-white text-blue-900 shadow-sm"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/50"
        } ${!value ? "text-slate-400" : "font-semibold"}`}
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
              initial="hidden"
              animate="show"
              exit="exit"
              variants={variants.dropdown}
              className="absolute top-full z-40 mt-1.5 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-100 bg-white/95 p-1 shadow-xl backdrop-blur-xl"
            >
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                }}
                className={`w-full rounded-lg px-3 py-2 text-right text-sm transition-colors ${
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
                  className={`w-full rounded-lg px-3 py-2 text-right text-sm transition-colors ${
                    value === opt.value
                      ? "bg-blue-50 font-bold text-blue-700"
                      : "font-semibold text-slate-700 hover:bg-slate-50"
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
      setFeedback({ type: "success", msg: "تم تقديم طلب التقرير بنجاح وقيد المعالجة الآن." });
      setReportType("");
      setFormats(["pdf"]);
      setDistrictId("");
      void utils.reports.listJobs.invalidate();
    },
    onError: (err) => {
      setFeedback({ type: "error", msg: err.message || "فشل في طلب إنشاء التقرير" });
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
    <Card className="overflow-hidden border border-slate-100 shadow-md">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4 px-6">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-blue-50 p-1.5">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <CardTitle>إنشاء تقرير جديد</CardTitle>
        </div>
      </CardHeader>
      <CardBody className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Custom Visual Report Type Grid */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-800">
              نوع التقرير المطلوب
            </label>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {availableReportTypes.map((type) => {
                const isSelected = reportType === type;
                return (
                  <motion.button
                    key={type}
                    type="button"
                    whileHover={{ y: -2, scale: 1.01 }}
                    whileTap={tapFeedback}
                    onClick={() => setReportType(type)}
                    className={`flex flex-col text-right items-start gap-2.5 rounded-xl border p-4 transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/30 ring-2 ring-blue-500/20"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/30"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <div className={`rounded-xl p-2 ${isSelected ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                        {REPORT_TYPE_ICONS[type] ?? <FileText className="h-5 w-5" />}
                      </div>
                      {isSelected && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
                          ✓
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">
                        {REPORT_TYPE_LABELS[type] ?? type}
                      </h4>
                      <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                        {REPORT_TYPE_DESCRIPTIONS[type] ?? ""}
                      </p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Formats Selection */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-800">
                صيغة الملف (يمكن اختيار أكثر من صيغة)
              </label>
              <div className="flex flex-wrap gap-2.5">
                {(["pdf", "csv", "xlsx"] as const).map((format) => {
                  const isSelected = formats.includes(format);
                  return (
                    <motion.button
                      key={format}
                      type="button"
                      whileTap={tapFeedback}
                      onClick={() => toggleFormat(format)}
                      className={`relative flex items-center gap-2 rounded-xl border px-5 py-3 text-xs font-bold uppercase transition-all ${
                        isSelected
                          ? "border-blue-500 bg-blue-50/50 text-blue-600 ring-1 ring-blue-500/30"
                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${isSelected ? "bg-blue-500" : "bg-slate-300"}`} />
                      <span>{format}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Scope Selection */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-800">
                نطاق التقرير الجغرافي
              </label>
              <div className="relative flex rounded-xl bg-slate-100 p-1">
                {(["global", "district"] as const).map((scope) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => setScopeType(scope)}
                    className={`relative flex-1 py-2 text-center text-xs font-bold transition-all z-10 ${
                      scopeType === scope ? "text-slate-900" : "text-slate-500"
                    }`}
                  >
                    {scope === "global" ? "عام (المستوى الوطني)" : "مركز مخصص"}
                    {scopeType === scope && (
                      <motion.div
                        layoutId="activeScopeBg"
                        className="absolute inset-0 rounded-lg bg-white shadow-sm -z-10"
                        transition={springs.silk}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* District ID Input with spring entrance */}
          <AnimatePresence>
            {scopeType === "district" && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                transition={springs.floaty}
                className="overflow-hidden space-y-2"
              >
                <label className="text-xs font-semibold text-slate-600">
                  معرّف المركز (UUID)
                </label>
                <input
                  type="text"
                  value={districtId}
                  onChange={(e) => setDistrictId(e.target.value)}
                  placeholder="أدخل معرّف المركز هنا (مثال: d6c873a7-...)"
                  className="w-full rounded-[10px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:outline-none transition-all"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {scopeType === "global" && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50/50 border border-amber-100 p-3 text-xs text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>ملاحظة: يتطلب إنشاء تقارير على النطاق العام صلاحيات إدارية عليا (Admin / Auditor).</span>
            </div>
          )}

          {/* Feedback */}
          <AnimatePresence>
            {feedback && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`flex items-center gap-2.5 rounded-xl p-4 text-sm font-semibold border ${
                  feedback.type === "error"
                    ? "border-red-200 bg-red-50/50 text-red-800"
                    : "border-emerald-200 bg-emerald-50/50 text-emerald-800"
                }`}
              >
                {feedback.type === "error" ? (
                  <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
                ) : (
                  <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
                )}
                <span>{feedback.msg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            type="submit"
            disabled={
              createMutation.isPending ||
              !reportType ||
              (scopeType === "district" && !districtId.trim())
            }
            className="w-full rounded-xl py-3 font-bold text-sm tracking-wide shadow-sm"
          >
            {createMutation.isPending ? "جاري جدولة الطلب..." : "إنشاء التقرير وبدء المعالجة"}
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
  onDeleted,
}: {
  jobId: string;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const { data, isLoading, isFetching, error } = api.reports.getJob.useQuery({
    reportJobId: jobId,
  });
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const utils = api.useUtils();
  const deleteMutation = api.reports.deleteJob.useMutation({
    onSuccess: () => {
      setIsDeleting(false);
      void utils.reports.listJobs.invalidate();
      if (onDeleted) onDeleted();
      onClose();
    },
    onError: (err) => {
      setIsDeleting(false);
      alert("فشل حذف التقرير: " + err.message);
    },
  });

  useEffect(() => {
    if (!downloadingId || !data) return;
    const artifact = data.artifacts.find((a) => a.id === downloadingId);
    if (artifact) window.open(`/api/reports/download/${artifact.id}`, "_blank");
    setDownloadingId(null);
  }, [downloadingId, data]);

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleDelete = () => {
    if (deleteMutation.isPending) return;
    deleteMutation.mutate({ reportJobId: jobId });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-md sm:items-center sm:p-4"
      onClick={handleBackdrop}
    >
      <motion.div
        initial="hidden"
        animate="show"
        exit="exit"
        variants={variants.modal}
        className="flex max-h-[90vh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:max-w-lg sm:rounded-[24px]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-blue-50 p-1">
              <FileText className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-slate-800 font-bold">تفاصيل التقرير</span>
            {(isLoading || isFetching) && (
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 transition-colors hover:bg-slate-200"
          >
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : error || !data ? (
            <div className="py-12 text-center text-red-500 font-semibold flex flex-col items-center gap-2">
              <AlertCircle className="h-8 w-8" />
              <span>فشل تحميل تفاصيل التقرير</span>
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
                        : "مركز مخصص",
                  },
                  {
                    label: "تاريخ الطلب",
                    value: new Date(data.job.createdAt).toLocaleDateString(
                      "ar-EG",
                      { day: "numeric", month: "long", year: "numeric" },
                    ),
                  },
                  {
                    label: "تاريخ الإكمال",
                    value: data.job.completedAt
                      ? new Date(data.job.completedAt).toLocaleDateString(
                          "ar-EG",
                          { day: "numeric", month: "long", year: "numeric" },
                        )
                      : "—",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5"
                  >
                    <div className="mb-1 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">
                      {item.label}
                    </div>
                    <div className="text-slate-800 text-sm font-bold">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Status */}
              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                <span className="text-xs font-bold text-slate-500">
                  حالة معالجة التقرير
                </span>
                <Badge variant={STATUS_VARIANTS[data.job.status]} dot pulse={data.job.status === "processing"}>
                  {STATUS_LABELS[data.job.status]}
                </Badge>
              </div>

              {/* Error */}
              {data.job.errorDetail && (
                <div className="rounded-xl border border-red-200 bg-red-50/50 p-3.5 flex gap-2.5 items-start">
                  <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
                  <div>
                    <div className="text-xs font-extrabold text-red-700">تفاصيل الفشل</div>
                    <div className="text-xs text-red-600 mt-1 leading-relaxed">
                      {data.job.errorDetail}
                    </div>
                  </div>
                </div>
              )}

              {/* Artifacts */}
              <div className="space-y-2">
                <div className="text-slate-800 text-sm font-bold">
                  الملفات المستخرجة المتاحة
                </div>
                {data.artifacts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/30 p-6 text-center text-sm text-slate-400">
                    لا توجد ملفات جاهزة للتحميل بعد
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.artifacts.map((artifact) => (
                      <div
                        key={artifact.id}
                        className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3 hover:border-slate-200 transition-all shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span className="bg-blue-50 text-blue-700 rounded-lg px-2.5 py-1 text-xs font-bold uppercase ring-1 ring-blue-500/10">
                            {artifact.format}
                          </span>
                          {artifact.fileSizeBytes && (
                            <span className="text-xs font-medium text-slate-400">
                              {(artifact.fileSizeBytes / 1024).toFixed(1)} KB
                            </span>
                          )}
                        </div>
                        {artifact.status === "ready" ? (
                          <motion.button
                            whileTap={tapFeedback}
                            onClick={() => setDownloadingId(artifact.id)}
                            disabled={downloadingId !== null}
                            className="bg-blue-600 hover:bg-blue-700 flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold text-white transition-all disabled:opacity-50"
                          >
                            <Download className="h-3.5 w-3.5" />
                            تحميل
                          </motion.button>
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

        {/* Footer with Delete and Close */}
        <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4 flex gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold"
          >
            إغلاق
          </Button>

          {/* Delete Option inside Modal */}
          {data && !isLoading && (
            <AnimatePresence>
              {!isDeleting ? (
                <motion.button
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => setIsDeleting(true)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-red-200 hover:bg-red-50 text-red-600 font-bold px-4 py-2.5 text-sm transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                  حذف من السجل
                </motion.button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex gap-2"
                >
                  <button
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 text-xs transition-all"
                  >
                    {deleteMutation.isPending ? "جاري الحذف..." : "تأكيد الحذف"}
                  </button>
                  <button
                    onClick={() => setIsDeleting(false)}
                    className="rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold px-4 py-2.5 text-xs transition-all"
                  >
                    إلغاء
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </motion.div>
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
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [openingJobId, setOpeningJobId] = useState<string | null>(null);
  const pageSize = 10;
  const utils = api.useUtils();

  const { data, isLoading, error } = api.reports.listJobs.useQuery({
    page,
    pageSize,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const deleteMutation = api.reports.deleteJob.useMutation({
    onSuccess: () => {
      setDeletingJobId(null);
      void utils.reports.listJobs.invalidate();
    },
    onError: (err) => {
      alert("فشل حذف التقرير: " + err.message);
    },
  });

  const handleDelete = (jobId: string) => {
    deleteMutation.mutate({ reportJobId: jobId });
  };

  const handleView = (jobId: string) => {
    setOpeningJobId(jobId);
    onViewReport(jobId);
  };

  const jobs = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  if (error) {
    return (
      <Card className="border border-red-100 bg-red-50/30">
        <CardBody className="py-12 text-center flex flex-col items-center justify-center gap-2">
          <AlertCircle className="h-8 w-8 text-red-600 animate-bounce" />
          <p className="font-bold text-red-700">تعذر تحميل قائمة التقارير التاريخية</p>
          <p className="text-xs text-slate-400">
            يرجى التأكد من اتصال قاعدة البيانات وتشغيل عمليات الهجرة بشكل صحيح
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="border border-slate-100 shadow-md overflow-hidden">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4 px-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <CardTitle>سجل التقارير المستخرجة</CardTitle>
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
                { value: "all", label: "كل التقارير" },
                ...Object.entries(STATUS_LABELS).map(([v, l]) => ({
                  value: v,
                  label: l,
                })),
              ]}
            />
          </div>
        </div>
      </CardHeader>

      {/* Mobile — Sleek Cards (with In-place Deletion) */}
      <div className="block divide-y divide-slate-100 sm:hidden">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3 p-5">
              <Skeleton className="h-5 w-3/4 rounded-lg" />
              <Skeleton className="h-4 w-1/2 rounded-lg" />
            </div>
          ))
        ) : jobs.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            لا توجد تقارير في السجل حالياً
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {jobs.map((job) => (
              <motion.div
                key={job.id}
                whileTap={{ scale: 0.99 }}
                className="p-4 rounded-xl border border-slate-100 bg-white shadow-sm hover:border-slate-200 transition-all flex flex-col gap-3.5 relative overflow-hidden"
              >
                <div
                  className={`flex items-start justify-between cursor-pointer ${openingJobId === job.id ? "pointer-events-none opacity-60" : ""}`}
                  onClick={() => handleView(job.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-slate-800 text-sm font-bold truncate">
                      {openingJobId === job.id && (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />
                      )}
                      <span className="truncate">
                        {REPORT_TYPE_LABELS[job.reportType] ?? job.reportType}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-400">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>{new Date(job.createdAt).toLocaleDateString("ar-EG")}</span>
                    </div>
                  </div>
                  <Badge variant={STATUS_VARIANTS[job.status]} dot>
                    {STATUS_LABELS[job.status]}
                  </Badge>
                </div>

                <div className="border-t border-slate-50 pt-3 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400">
                    ID: {job.id.slice(0, 8)}
                  </span>
                  
                  {/* Action buttons or confirm state */}
                  <AnimatePresence mode="wait">
                    {deletingJobId === job.id ? (
                      <motion.div
                        key="confirm"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="flex items-center gap-2"
                      >
                        <span className="text-xs text-red-500 font-bold">تأكيد حذف التقرير؟</span>
                        <button
                          onClick={() => handleDelete(job.id)}
                          disabled={deleteMutation.isPending}
                          className="bg-red-50 text-red-700 hover:bg-red-100 text-xs font-bold rounded-lg px-3 py-1.5"
                        >
                          {deleteMutation.isPending ? "حذف..." : "حذف"}
                        </button>
                        <button
                          onClick={() => setDeletingJobId(null)}
                          className="bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold rounded-lg px-3 py-1.5"
                        >
                          إلغاء
                        </button>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="actions"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex items-center gap-2"
                      >
                        <button
                          onClick={() => handleView(job.id)}
                          disabled={openingJobId !== null}
                          className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 transition-colors disabled:opacity-60 flex items-center gap-1.5"
                        >
                          {openingJobId === job.id && (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                          عرض الملف
                        </button>
                        <button
                          onClick={() => setDeletingJobId(job.id)}
                          className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg border border-red-50 transition-colors"
                          title="حذف من السجل"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Desktop — Polished Table (with Sticky Headers & Row Hover lift) */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                معرف التقرير
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                النوع
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                الحالة
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                تاريخ الإنشاء
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">
                العمليات
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-6 py-4">
                      <Skeleton className="h-4 rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : jobs.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-sm text-slate-400 font-semibold"
                >
                  لا توجد تقارير في السجل حالياً
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <motion.tr
                  key={job.id}
                  whileHover={{ backgroundColor: "rgba(248, 250, 252, 0.5)" }}
                  className={`transition-colors duration-150 ${openingJobId === job.id ? "cursor-wait" : "cursor-pointer"}`}
                  onClick={() => handleView(job.id)}
                >
                  <td className="px-6 py-4 font-mono text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      {openingJobId === job.id && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                      )}
                      {job.id.slice(0, 8)}...
                    </div>
                  </td>
                  <td className="text-slate-800 px-6 py-4 font-bold">
                    {REPORT_TYPE_LABELS[job.reportType] ?? job.reportType}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={STATUS_VARIANTS[job.status]} dot>
                      {STATUS_LABELS[job.status]}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-xs font-semibold">
                    {new Date(job.createdAt).toLocaleDateString("ar-EG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-6 py-4 text-left" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-3">
                      <AnimatePresence mode="wait">
                        {deletingJobId === job.id ? (
                          <motion.div
                            key="confirm"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="flex items-center gap-2"
                          >
                            <span className="text-xs text-red-500 font-bold">تأكيد حذف السجل؟</span>
                            <button
                              onClick={() => handleDelete(job.id)}
                              disabled={deleteMutation.isPending}
                              className="bg-red-50 text-red-700 hover:bg-red-100 hover:underline text-xs font-bold rounded-lg px-3 py-1.5"
                            >
                              {deleteMutation.isPending ? "حذف..." : "حذف"}
                            </button>
                            <button
                              onClick={() => setDeletingJobId(null)}
                              className="bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold rounded-lg px-3 py-1.5"
                            >
                              إلغاء
                            </button>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="actions"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex items-center gap-2"
                          >
                            <button
                              onClick={() => handleView(job.id)}
                              disabled={openingJobId !== null}
                              className="text-xs font-bold text-blue-600 hover:underline px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-60 flex items-center gap-1.5"
                            >
                              {openingJobId === job.id && (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              )}
                              عرض
                            </button>
                            <button
                              onClick={() => setDeletingJobId(job.id)}
                              className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                              title="حذف من السجل"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <CardFooter className="flex items-center justify-between border-t border-slate-100 bg-slate-50/20 px-6 py-4">
          <span className="text-xs font-semibold text-slate-400">
            عرض {Math.min(page * pageSize, total)} من {total} تقرير
          </span>
          <div className="flex items-center gap-3">
            <motion.button
              whileTap={tapFeedback}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white transition-all hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight className="h-4.5 w-4.5" />
            </motion.button>
            <span className="text-xs font-bold text-slate-600">
              {page} / {totalPages}
            </span>
            <motion.button
              whileTap={tapFeedback}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white transition-all hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4.5 w-4.5" />
            </motion.button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

export function ReportsClient() {
  const [viewingReportId, setViewingReportId] = useState<string | null>(null);
  const [openingJobId, setOpeningJobId] = useState<string | null>(null);
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={variants.staggerContainer}
      className="space-y-6 p-4 md:p-6"
      dir="rtl"
    >
      <motion.div variants={variants.fadeSlideUp} className="flex flex-col gap-1.5">
        <h1 className="text-slate-800 text-2xl font-black md:text-3xl tracking-tight">
          التقارير والنماذج
        </h1>
        <p className="text-sm font-semibold text-slate-400">
          جدولة وتوليد وإدارة تقارير ووثائق امتثال المياه والحوكمة
        </p>
      </motion.div>

      <div className="space-y-6">
        <motion.div variants={variants.fadeSlideUp}>
          <ReportGenerator />
        </motion.div>
        
        <motion.div variants={variants.fadeSlideUp}>
          <ReportsTable
            onViewReport={(jobId) => {
              setOpeningJobId(jobId);
              setViewingReportId(jobId);
            }}
          />
        </motion.div>
      </div>

      <AnimatePresence>
        {viewingReportId && (
          <ReportDetailModal
            jobId={viewingReportId}
            onClose={() => {
              setOpeningJobId(null);
              setViewingReportId(null);
            }}
            onDeleted={() => {
              setOpeningJobId(null);
              setViewingReportId(null);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
