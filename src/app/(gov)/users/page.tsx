"use client";

import { useState } from "react";
import Papa from "papaparse";
import { z } from "zod";
import { api } from "~/trpc/react";
import { Button } from "~/app/_components/UI/Button";

// Matches backend z.object
const provisionInputSchema = z.object({
  fullName: z.string().min(2),
  nationalId: z.string().regex(/^\d{8,20}$/, "Valid National ID is required"),
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

export default function UserManagementPage() {
  const [activeMode, setActiveMode] = useState<"single" | "bulk">("single");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
          User Management
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Provision new user identities and send secure activation invitations.
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
            Single Invite
          </button>
          <button
            onClick={() => setActiveMode("bulk")}
            className={`px-2 pb-4 text-sm font-medium ${
              activeMode === "bulk"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            Bulk Provision (CSV)
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
            msg: `Invitation sent securely to ${parsed.email}`,
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
            msg: "User already has a pending invitation. You can resend the link from their profile.",
          });
          break;
        case "USER_ALREADY_EXISTS":
        case "USER_EXISTS_NO_INVITE":
          setFeedback({
            type: "error",
            msg: "This user already has an active account.",
          });
          break;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedback({ type: "error", msg: msg || "Failed to parse or send." });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Full Name
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
            National ID
          </label>
          <input
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            value={formData.nationalId}
            onChange={(e) =>
              setFormData({ ...formData, nationalId: e.target.value })
            }
            placeholder="14 digits"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Email Address
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
            Phone (Optional)
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
            System Role
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
            <option value="farmer">Farmer</option>
            <option value="farm_owner">Farm Owner</option>
            <option value="auditor">Auditor / Inspector</option>
            <option value="district_manager">District Manager</option>
            <option value="admin">Administrator</option>
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
          {createMutation.isPending
            ? "Sending Invite..."
            : "Create & Send Invitation"}
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
              `Row ${index + 2}: ${parseRes.error.issues[0]?.message}`,
            );
          }
        });

        if (validRows.length > 50) {
          errors.push("Maximum 50 users allowed per bulk upload.");
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
      setParseErrors([msg || "Bulk provision API request failed"]);
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
          Upload a CSV file containing user records.
        </p>
        <p className="mb-6 text-xs text-gray-500">
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
            Validation Errors Found
          </h4>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {parseErrors.slice(0, 5).map((e, idx) => (
              <li key={idx}>{e}</li>
            ))}
            {parseErrors.length > 5 && (
              <li>...and {parseErrors.length - 5} more</li>
            )}
          </ul>
        </div>
      )}

      {parsedData.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 p-4">
            <span className="text-sm font-medium text-blue-800">
              {parsedData.length} valid records ready for staging.
            </span>
            <Button
              onClick={handleBulkSubmit}
              disabled={bulkMutation.isPending}
            >
              {bulkMutation.isPending
                ? "Sending Batches..."
                : "Execute Bulk Provision"}
            </Button>
          </div>

          <div className="ring-opacity-5 overflow-hidden shadow ring-1 ring-black sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3.5 pr-3 pl-4 text-left text-sm font-semibold text-gray-900">
                    Name
                  </th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    National ID
                  </th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Email
                  </th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Role
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {parsedData.slice(0, 5).map((row, idx) => (
                  <tr key={idx}>
                    <td className="py-4 pr-3 pl-4 text-sm font-medium whitespace-nowrap text-gray-900">
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
                Showing first 5 rows of {parsedData.length}
              </div>
            )}
          </div>
        </div>
      )}

      {results && (
        <div className="mt-8 overflow-hidden rounded-lg border border-gray-200">
          <div className="flex items-center justify-between border-b bg-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-800">
              Execution Report
            </h3>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              Completed
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
