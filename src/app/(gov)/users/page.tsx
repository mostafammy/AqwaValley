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
  roleType: z.enum(["admin", "district_manager", "farm_owner", "farmer", "auditor"]),
  phone: z.string().optional(),
  districtId: z.string().uuid().optional(),
  farmId: z.string().uuid().optional(),
});

type ProvisionInput = z.infer<typeof provisionInputSchema>;

export default function UserManagementPage() {
  const [activeMode, setActiveMode] = useState<"single" | "bulk">("single");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 p-6 bg-white shadow-sm rounded-xl">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">User Management</h1>
        <p className="mt-2 text-sm text-gray-500">
          Provision new user identities and send secure activation invitations.
        </p>
        <div className="mt-6 flex gap-4 border-b border-gray-200">
          <button
            onClick={() => setActiveMode("single")}
            className={`pb-4 px-2 text-sm font-medium ${
              activeMode === "single"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Single Invite
          </button>
          <button
            onClick={() => setActiveMode("bulk")}
            className={`pb-4 px-2 text-sm font-medium ${
              activeMode === "bulk"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Bulk Provision (CSV)
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        {activeMode === "single" ? <SingleProvisionForm /> : <BulkProvisionArea />}
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

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    // Sanitize empty strings to undefined for UUID fields
    const payload = {
      ...formData,
      districtId: formData.districtId || undefined,
      farmId: formData.farmId || undefined,
      phone: formData.phone || undefined,
    };

    try {
      const parsed = provisionInputSchema.parse(payload);
      const res = await createMutation.mutateAsync(parsed);
      
      switch (res.status) {
        case "INVITED":
          setFeedback({ type: "success", msg: `Invitation sent securely to ${parsed.email}` });
          setFormData({ ...formData, fullName: "", nationalId: "", email: "", phone: "" });
          break;
        case "PENDING_INVITATION":
          setFeedback({ type: "success", msg: "User already has a pending invitation. You can resend the link from their profile." });
          break;
        case "USER_ALREADY_EXISTS":
        case "USER_EXISTS_NO_INVITE":
          setFeedback({ type: "error", msg: "This user already has an active account." });
          break;
      }
    } catch (err: any) {
      setFeedback({ type: "error", msg: err.message || "Failed to parse or send." });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Full Name</label>
          <input
            required
            className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 border shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">National ID</label>
          <input
            required
            className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 border shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            value={formData.nationalId}
            onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
            placeholder="14 digits"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Email Address</label>
          <input
            required
            type="email"
            className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 border shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Phone (Optional)</label>
          <input
            className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 border shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            value={formData.phone ?? ""}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">System Role</label>
          <select
            className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 border shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            value={formData.roleType}
            onChange={(e) => setFormData({ ...formData, roleType: e.target.value as any })}
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
        <div className={`p-4 rounded-md ${feedback.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
          <p className="text-sm font-medium">{feedback.msg}</p>
        </div>
      )}

      <div>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Sending Invite..." : "Create & Send Invitation"}
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
  const [results, setResults] = useState<any[] | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data as any[];
        const errors: string[] = [];
        const validRows: ProvisionInput[] = [];

        rows.forEach((row, index) => {
          const payload = {
            fullName: row.fullName?.trim(),
            nationalId: row.nationalId?.trim(),
            email: row.email?.trim(),
            roleType: row.roleType?.trim() || "farmer",
            phone: row.phone?.trim() || undefined,
            districtId: row.districtId?.trim() || undefined,
            farmId: row.farmId?.trim() || undefined,
          };

          const parseRes = provisionInputSchema.safeParse(payload);
          if (parseRes.success) {
            validRows.push(parseRes.data);
          } else {
            errors.push(`Row ${index + 2}: ${parseRes.error.issues[0]?.message}`);
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
      const res = await bulkMutation.mutateAsync({ users: parsedData });
      setResults(res);
      setParsedData([]); // Clear post-success
    } catch (err: any) {
      setParseErrors([err.message || "Bulk provision API request failed"]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border border-dashed border-gray-300 rounded-lg p-10 bg-gray-50 flex flex-col items-center">
        <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-sm text-gray-600 mb-2">Upload a CSV file containing user records.</p>
        <p className="text-xs text-gray-500 mb-6">Headers required: fullName, nationalId, email (optional: roleType, phone, districtId, farmId)</p>
        <input 
          type="file" 
          accept=".csv" 
          onChange={handleFileUpload}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      {parseErrors.length > 0 && (
        <div className="p-4 bg-red-50 text-red-800 rounded-md">
          <h4 className="font-semibold text-sm mb-2">Validation Errors Found</h4>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {parseErrors.slice(0, 5).map((e, idx) => <li key={idx}>{e}</li>)}
            {parseErrors.length > 5 && <li>...and {parseErrors.length - 5} more</li>}
          </ul>
        </div>
      )}

      {parsedData.length > 0 && (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md flex justify-between items-center">
            <span className="text-sm text-blue-800 font-medium">{parsedData.length} valid records ready for staging.</span>
            <Button onClick={handleBulkSubmit} disabled={bulkMutation.isPending}>
              {bulkMutation.isPending ? "Sending Batches..." : "Execute Bulk Provision"}
            </Button>
          </div>

          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">Name</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">National ID</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Email</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {parsedData.slice(0, 5).map((row, idx) => (
                  <tr key={idx}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">{row.fullName}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{row.nationalId}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{row.email}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 capitalize">{row.roleType?.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedData.length > 5 && (
              <div className="bg-gray-50 px-4 py-3 text-sm text-gray-500 text-center border-t border-gray-200">
                Showing first 5 rows of {parsedData.length}
              </div>
            )}
          </div>
        </div>
      )}

      {results && (
        <div className="mt-8 border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-100 px-4 py-3 border-b flex justify-between items-center">
            <h3 className="font-semibold text-gray-800 text-sm">Execution Report</h3>
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">Completed</span>
          </div>
          <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {results.map((res, i) => (
              <li key={i} className="p-4 flex flex-col hover:bg-gray-50">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-sm text-gray-800">{res.nationalId}</span>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    res.status === 'created' ? 'bg-green-100 text-green-800' :
                    res.status === 'skipped' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {res.status.toUpperCase()}
                  </span>
                </div>
                {res.reason && <p className="text-xs text-gray-500 mt-2">{res.reason}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
