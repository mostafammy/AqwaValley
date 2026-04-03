"use client";

import { useState } from "react";
import Papa from "papaparse";
import { z } from "zod";
import { api } from "~/trpc/react";
import { Button } from "~/app/_components/UI/Button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  CardFooter,
} from "~/app/_components/UI/Card";
import { Badge } from "~/app/_components/UI/Badge";

// Matches backend z.object
const provisionInputSchema = z.object({
  fullName: z.string().min(2),
  nationalId: z.string().regex(/^\d{8,20}$/, "مطلوب رقم قومي صحيح"),
  email: z.string().email(),
  roleType: z.enum([
    "admin",
    "district_manager",
    "farm_owner",
    "farmer",
    "auditor",
  ]),
  phone: z.string().optional(),
  districtId: z.string().uuid().optional(),
  farmId: z.string().uuid().optional(),
});

type ProvisionInput = z.infer<typeof provisionInputSchema>;

interface UserListItem {
  userId: string;
  fullName: string;
  nationalId: string;
  email?: string;
  phoneNumber?: string;
  roleType: "admin" | "district_manager" | "farm_owner" | "farmer" | "auditor";
  roleDisplayName?: string;
  isActive: boolean;
  farmId?: string;
  farmName?: string;
  farmArea?: number;
  farmQuota?: string | number;
}

export function UserManagementClient() {
  const [activeMode, setActiveMode] = useState<"single" | "bulk">("single");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
          إدارة المستخدمين
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          إنشاء هويات جديدة للمستخدمين وإرسال دعوات تفعيل آمنة.
        </p>
        <div className="mt-6 flex gap-4 border-b border-gray-200">
          <button
            onClick={() => setActiveMode("single")}
            className={`px-2 pb-4 text-sm font-medium ${
              activeMode === "single"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            دعوة فردية
          </button>
          <button
            onClick={() => setActiveMode("bulk")}
            className={`px-2 pb-4 text-sm font-medium ${
              activeMode === "bulk"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            إضافة جماعية (CSV)
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        {activeMode === "single" ? (
          <SingleProvisionForm />
        ) : (
          <BulkProvisionArea />
        )}
      </div>

      <div className="mt-8 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-6 text-2xl font-extrabold tracking-tight text-gray-900">
          دليل المستخدمين
        </h2>
        <UserListDirectory />
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Component: Single Provision
// -------------------------------------------------------------
function SingleProvisionForm() {
  const createMutation = api.users.createAndInvite.useMutation();

  const [formData, setFormData] = useState<ProvisionInput>({
    fullName: "",
    nationalId: "",
    email: "",
    roleType: "farmer",
    phone: "",
    districtId: "",
    farmId: "",
  });

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    // Sanitize empty strings to undefined for UUID fields
    const payload = {
      ...formData,
      districtId: formData.districtId === "" ? undefined : formData.districtId,
      farmId: formData.farmId === "" ? undefined : formData.farmId,
      phone: formData.phone === "" ? undefined : formData.phone,
    };

    try {
      const parsed = provisionInputSchema.parse(payload);
      const res = await createMutation.mutateAsync(parsed);

      switch (res.status) {
        case "INVITED":
          setFeedback({
            type: "success",
            msg: `تم إرسال الدعوة بأمان إلى ${parsed.email}`,
          });
          setFormData({
            ...formData,
            fullName: "",
            nationalId: "",
            email: "",
            phone: "",
          });
          break;
        case "PENDING_INVITATION":
          setFeedback({
            type: "success",
            msg: "المستخدم لديه دعوة معلقة بالفعل. يمكنك إعادة إرسال الرابط من ملفه الشخصي.",
          });
          break;
        case "USER_ALREADY_EXISTS":
        case "USER_EXISTS_NO_INVITE":
          setFeedback({
            type: "error",
            msg: "هذا المستخدم لديه حساب نشط بالفعل.",
          });
          break;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedback({ type: "error", msg: msg || "فشل في التحليل أو الإرسال." });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            الاسم الكامل
          </label>
          <input
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            value={formData.fullName}
            onChange={(e) =>
              setFormData({ ...formData, fullName: e.target.value })
            }
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            الرقم القومي
          </label>
          <input
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            value={formData.nationalId}
            onChange={(e) =>
              setFormData({ ...formData, nationalId: e.target.value })
            }
            placeholder="14 رقماً"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            البريد الإلكتروني
          </label>
          <input
            required
            type="email"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            رقم الهاتف (اختياري)
          </label>
          <input
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            value={formData.phone ?? ""}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            صلاحية النظام
          </label>
          <select
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            value={formData.roleType}
            onChange={(e) =>
              setFormData({
                ...formData,
                roleType: e.target.value as ProvisionInput["roleType"],
              })
            }
          >
            <option value="farmer">مزارع</option>
            <option value="farm_owner">مالك مزرعة</option>
            <option value="auditor">مفتش / مدقق</option>
            <option value="district_manager">مدير منطقة</option>
            <option value="admin">مدير نظام</option>
          </select>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-md p-4 ${feedback.type === "error" ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}
        >
          <p className="text-sm font-medium">{feedback.msg}</p>
        </div>
      )}

      <div>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "جاري الإرسال..." : "إنشاء وإرسال الدعوة"}
        </Button>
      </div>
    </form>
  );
}

// -------------------------------------------------------------
// Component: Bulk Provision
// -------------------------------------------------------------
function BulkProvisionArea() {
  const bulkMutation = api.users.bulkProvision.useMutation();
  const [parsedData, setParsedData] = useState<ProvisionInput[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  type BulkResult = {
    nationalId?: string;
    status?: "created" | "skipped" | "failed";
    userId?: string;
    reason?: string;
  };

  const [results, setResults] = useState<BulkResult[] | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result: Papa.ParseResult<Record<string, string>>) => {
        const rows = result.data;
        const errors: string[] = [];
        const validRows: ProvisionInput[] = [];

        rows.forEach((row, index) => {
          const payload = {
            fullName: (row.fullName ?? "").trim(),
            nationalId: (row.nationalId ?? "").trim(),
            email: (row.email ?? "").trim(),
            roleType: row.roleType?.trim()
              ? (row.roleType.trim() as ProvisionInput["roleType"])
              : "farmer",
            phone: row.phone?.trim() ? row.phone.trim() : undefined,
            districtId: row.districtId?.trim()
              ? row.districtId.trim()
              : undefined,
            farmId: row.farmId?.trim() ? row.farmId.trim() : undefined,
          };

          const parseRes = provisionInputSchema.safeParse(payload);
          if (parseRes.success) {
            validRows.push(parseRes.data);
          } else {
            errors.push(
              `الصف ${index + 2}: ${parseRes.error.issues[0]?.message}`,
            );
          }
        });

        if (validRows.length > 50) {
          errors.push("يسمح بحد أقصى 50 مستخدما لكل رفع جماعي.");
          setParsedData([]);
        } else {
          setParsedData(validRows);
        }
        setParseErrors(errors);
        setResults(null);
      },
    });
  };

  const handleBulkSubmit = async () => {
    if (parsedData.length === 0) return;
    try {
      const res = (await bulkMutation.mutateAsync({
        users: parsedData,
      })) as unknown as BulkResult[];
      setResults(res);
      setParsedData([]); // Clear post-success
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setParseErrors([msg || "فشل طلب الإضافة الجماعية"]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10">
        <svg
          className="mb-4 h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <p className="mb-2 text-sm text-gray-600">
          قم برفع ملف CSV يحتوي على سجلات للمستخدمين.
        </p>
        <p className="mb-6 text-xs text-gray-500" dir="ltr">
          Headers required: fullName, nationalId, email (optional: roleType,
          phone, districtId, farmId)
        </p>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      {parseErrors.length > 0 && (
        <div className="rounded-md bg-red-50 p-4 text-red-800">
          <h4 className="mb-2 text-sm font-semibold">
            تم العثور على أخطاء في التحقق
          </h4>
          <ul
            className="list-disc space-y-1 pr-5 text-sm"
            style={{ paddingRight: "1.25rem" }}
          >
            {parseErrors.slice(0, 5).map((e, idx) => (
              <li key={idx}>{e}</li>
            ))}
            {parseErrors.length > 5 && (
              <li>...و {parseErrors.length - 5} أكثر</li>
            )}
          </ul>
        </div>
      )}

      {parsedData.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 p-4">
            <span className="text-sm font-medium text-blue-800">
              {parsedData.length} سجلات صالحة جاهزة للتنفيذ.
            </span>
            <Button
              onClick={handleBulkSubmit}
              disabled={bulkMutation.isPending}
            >
              {bulkMutation.isPending
                ? "جاري الإرسال الدفعي..."
                : "تنفيذ الإضافة الجماعية"}
            </Button>
          </div>

          <div className="ring-opacity-5 overflow-hidden shadow ring-1 ring-black sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3.5 pr-4 pl-3 text-right text-sm font-semibold text-gray-900">
                    الاسم
                  </th>
                  <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                    الرقم القومي
                  </th>
                  <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                    البريد الإلكتروني
                  </th>
                  <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                    الصلاحية
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {parsedData.slice(0, 5).map((row, idx) => (
                  <tr key={idx}>
                    <td className="py-4 pr-4 pl-3 text-sm font-medium whitespace-nowrap text-gray-900">
                      {row.fullName}
                    </td>
                    <td className="px-3 py-4 text-sm whitespace-nowrap text-gray-500">
                      {row.nationalId}
                    </td>
                    <td className="px-3 py-4 text-sm whitespace-nowrap text-gray-500">
                      {row.email}
                    </td>
                    <td className="px-3 py-4 text-sm whitespace-nowrap text-gray-500 capitalize">
                      {row.roleType?.replace("_", " ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedData.length > 5 && (
              <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 text-center text-sm text-gray-500">
                عرض أول 5 صفوف من أصل {parsedData.length}
              </div>
            )}
          </div>
        </div>
      )}

      {results && (
        <div className="mt-8 overflow-hidden rounded-lg border border-gray-200">
          <div className="flex items-center justify-between border-b bg-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-800">
              تقرير التنفيذ
            </h3>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              مكتمل
            </span>
          </div>
          <ul className="max-h-96 divide-y divide-gray-200 overflow-y-auto">
            {results.map((res, i) => (
              <li key={i} className="flex flex-col p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-gray-800">
                    {res.nationalId}
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      res.status === "created"
                        ? "bg-green-100 text-green-800"
                        : res.status === "skipped"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {(res.status ?? "").toUpperCase()}
                  </span>
                </div>
                {res.reason && (
                  <p className="mt-2 text-xs text-gray-500">{res.reason}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Component: User List Directory
// -------------------------------------------------------------
function UserListDirectory() {
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const ctx = api.useUtils();
  const { data, isLoading } = api.users.listAll.useQuery({ page, pageSize });
  const deactivateMut = api.users.deactivate.useMutation({
    onSuccess: () => {
      ctx.users.listAll.invalidate();
      setSelectedUser(null);
      setConfirmAction(null);
    },
  });

  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "deactivate";
    userId: string;
    userName: string;
  } | null>(null);

  if (isLoading)
    return (
      <div className="py-10 text-center text-gray-500">
        جاري تحميل المستخدمين...
      </div>
    );

  const users = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="relative mt-4 space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:hidden">
        {users.map((u) => (
          <Card
            key={u.userId}
            className="cursor-pointer transition-colors"
            onClick={() => setSelectedUser(u)}
          >
            <CardBody size="sm">
              <div className="mb-2 flex items-start justify-between">
                <div className="font-bold text-gray-900">{u.fullName}</div>
                <Badge variant={u.isActive ? "ok" : "danger"} dot>
                  {u.isActive ? "نشط" : "معطل"}
                </Badge>
              </div>
              <div className="mb-1 text-sm text-gray-500">
                الرقم القومي: {u.nationalId}
              </div>
              <div className="text-sm text-gray-500">
                الصلاحية:{" "}
                <span className="font-medium text-gray-700">
                  {u.roleDisplayName ?? u.roleType}
                </span>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card className="hidden sm:block">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[700px] text-right align-middle text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] font-medium text-[var(--color-text-muted)]">
                <th className="px-4 py-3">الاسم</th>
                <th className="px-4 py-3">الرقم القومي</th>
                <th className="px-4 py-3">الصلاحية</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="w-28 px-4 py-3">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.userId}
                  className="border-b border-[var(--color-border)] transition hover:bg-[var(--color-bg-subtle)]"
                >
                  <td className="px-4 py-4 font-semibold text-[var(--color-text)]">
                    {u.fullName}
                  </td>
                  <td className="px-4 py-4 text-[var(--color-text-muted)]">
                    {u.nationalId}
                  </td>
                  <td className="px-4 py-4 font-medium text-[var(--color-text-muted)]">
                    {u.roleDisplayName ?? u.roleType}
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={u.isActive ? "ok" : "danger"} dot>
                      {u.isActive ? "نشط" : "معطل"}
                    </Badge>
                  </td>
                  <td className="px-4 py-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedUser(u)}
                    >
                      التفاصيل
                    </Button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-[var(--color-text-muted)]"
                  >
                    لا يوجد مستخدمين لعرضهم.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <CardFooter className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-3">
            <span className="text-sm text-[var(--color-text-muted)]">
              إظهار {Math.min(page * pageSize, total)} من أصل {total}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                السابق
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                التالي
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>

      {selectedUser && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30" />
          <div className="animate-in fade-in zoom-in-95 relative w-full max-w-lg rounded-xl bg-[var(--color-bg)] shadow-2xl">
            <Card className="border-0 shadow-none">
              <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-6 pt-4 pb-4">
                <CardTitle>بيانات المستخدم التفصيلية</CardTitle>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="rounded-full p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </CardHeader>

              <CardBody className="space-y-6 p-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-3">
                    <div className="text-[11px] font-bold tracking-wider text-[var(--color-text-muted)]">
                      الاسم الكامل
                    </div>
                    <div className="mt-1 font-semibold text-[var(--color-text)]">
                      {selectedUser.fullName}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-3">
                    <div className="text-[11px] font-bold tracking-wider text-[var(--color-text-muted)]">
                      الرقم القومي
                    </div>
                    <div className="mt-1 font-medium text-[var(--color-text)]">
                      {selectedUser.nationalId}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-3">
                    <div className="text-[11px] font-bold tracking-wider text-[var(--color-text-muted)]">
                      البريد الإلكتروني
                    </div>
                    <div className="mt-1 font-medium break-all text-[var(--color-text)]">
                      {selectedUser.email ?? "غير متوفر"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-3">
                    <div className="text-[11px] font-bold tracking-wider text-[var(--color-text-muted)]">
                      رقم الهاتف
                    </div>
                    <div className="mt-1 font-medium text-[var(--color-text)]">
                      {selectedUser.phoneNumber ?? "غير متوفر"}
                    </div>
                  </div>
                </div>

                {(selectedUser.roleType === "farmer" ||
                  selectedUser.roleType === "farm_owner") &&
                  selectedUser.farmId && (
                    <Card
                      accent="blue"
                      className="border border-[var(--color-border)] !shadow-none"
                    >
                      <CardHeader className="px-4 pt-4 pb-2">
                        <CardTitle>بيانات المزرعة المرتبطة</CardTitle>
                      </CardHeader>
                      <CardBody size="sm">
                        <div className="flex flex-col gap-3 px-2">
                          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
                            <span className="text-sm font-semibold text-[var(--color-text-muted)]">
                              اسم المزرعة
                            </span>
                            <span className="font-bold text-[var(--color-text)]">
                              {selectedUser.farmName}
                            </span>
                          </div>
                          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
                            <span className="text-sm font-semibold text-[var(--color-text-muted)]">
                              المساحة
                            </span>
                            <span className="font-bold text-[var(--color-text)]">
                              {selectedUser.farmArea} فدان
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-[var(--color-text-muted)]">
                              الحصة السنوية
                            </span>
                            <span className="font-bold text-[var(--color-primary-600)]">
                              {selectedUser.farmQuota &&
                                Number(
                                  selectedUser.farmQuota,
                                ).toLocaleString()}{" "}
                              م³
                            </span>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  )}
              </CardBody>
            </Card>

            <CardFooter className="flex items-center justify-between rounded-b-xl border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-4">
              <Button variant="secondary" onClick={() => setSelectedUser(null)}>
                إغلاق
              </Button>
              {selectedUser.isActive ? (
                <Button
                  variant="danger"
                  onClick={() =>
                    setConfirmAction({
                      type: "deactivate",
                      userId: selectedUser.userId,
                      userName: selectedUser.fullName,
                    })
                  }
                  disabled={deactivateMut.isPending}
                >
                  {deactivateMut.isPending ? "جاري..." : "تعطيل الحساب"}
                </Button>
              ) : (
                <Badge variant="danger" dot>
                  الحساب معطل
                </Badge>
              )}
            </CardFooter>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="animate-in fade-in zoom-in-95 relative w-full max-w-md rounded-xl bg-[var(--color-bg)] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <svg
                    className="h-5 w-5 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-[var(--color-text)]">
                  تأكيد التعطيل
                </h3>
              </div>
            </div>
            <p className="mb-6 text-[var(--color-text-muted)]">
              هل أنت متأكد من تعطيل حساب{" "}
              <span className="font-semibold text-[var(--color-text)]">
                {confirmAction.userName}
              </span>
              ؟ لن يستطيع هذا المستخدم تسجيل الدخول حتى تقوم بتفعيله مرة أخرى.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setConfirmAction(null)}
              >
                إلغاء
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  deactivateMut.mutate({ userId: confirmAction.userId });
                }}
                disabled={deactivateMut.isPending}
              >
                {deactivateMut.isPending ? "جاري التعطيل..." : "نعم، تعطيل"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
