"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";
import { authClient } from "~/server/better-auth/client";
import { Button } from "~/app/_components/UI/Button";

// Main Content that uses searchParams
function SetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenString = searchParams?.get("token");
  const token = tokenString ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // linkInvalid: controls the early-return invalid-link screen
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [linkErrorMsg, setLinkErrorMsg] = useState<string | null>(null);

  // formError: inline form validation / submit errors (separate concern)
  const [formError, setFormError] = useState<string | null>(null);

  // Queries & Mutations
  const {
    data: tokenData,
    isLoading,
    isError,
  } = api.users.validateToken.useQuery(
    { token },
    { enabled: !!tokenString, retry: false },
  );

  const acceptMutation = api.users.acceptInvitation.useMutation();
  const resetMutation = api.users.consumeResetToken.useMutation();

  useEffect(() => {
    if (!tokenString) {
      setLinkInvalid(true);
      setLinkErrorMsg("No token provided in the URL.");
    } else {
      setLinkInvalid(false);
      setLinkErrorMsg(null);
    }
  }, [tokenString]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-gray-600">Validating your secure link...</p>
        </div>
      </div>
    );
  }

  // Early return for errors or invalid links
  if (linkInvalid || isError || !tokenData?.valid) {
    const reason = tokenData?.valid === false ? (tokenData.reason as string) : "INVALID_TOKEN";
    const messages: Record<string, string> = {
      TOKEN_EXPIRED: "This link has expired. Please request a new one.",
      TOKEN_ALREADY_USED: "This link has already been used.",
      INVALID_TOKEN: "This link is missing or invalid.",
    };

    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
          <div className="mb-6 flex items-center justify-center text-red-500">
            <svg
              className="h-12 w-12"
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
          <h2 className="text-center text-2xl font-bold text-gray-900">
            Invalid Link
          </h2>
          <p className="mt-2 text-center text-gray-600">
            {linkErrorMsg ?? messages[reason] ?? messages.INVALID_TOKEN}
          </p>
          <div className="mt-6 flex justify-center">
            <Button onClick={() => router.push("/")} className="w-full">
              Return to Homepage
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isReset = tokenData?.tokenType === "password_reset";
  const title = isReset ? "Reset Your Password" : "Activate Your Account";
  const description = isReset
    ? "Enter a new secure password for your account."
    : "Welcome! Please set a password to activate your account.";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Clear form errors and validate locally
    setFormError(null);
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters long.");
      return;
    }

    try {
      let res;
      if (isReset) {
        res = await resetMutation.mutateAsync({ token, newPassword: password });
      } else {
        res = await acceptMutation.mutateAsync({
          token,
          newPassword: password,
        });
      }

      if (res.success && res.email) {
        // Automatically sign them in since we verified the token securely
        await authClient.signIn.email({ email: res.email, password });
        router.push("/dashboard"); // Redirect to dashboard after login
      } else {
        setFormError("An unexpected error occurred. Please contact support.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFormError(msg || "Failed to process your request.");
    }
  };

  const isSubmitting = acceptMutation.isPending || resetMutation.isPending;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-10 shadow-xl">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <svg
              className="h-6 w-6 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {title}
          </h2>
          <p className="mt-2 text-sm text-gray-600">{description}</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label
                className="mb-1 block text-sm font-medium text-gray-700"
                htmlFor="password"
              >
                New Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="relative block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
                placeholder="Enter 8+ characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label
                className="mb-1 block text-sm font-medium text-gray-700"
                htmlFor="confirm"
              >
                Confirm Password
              </label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                required
                className="relative block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          {formError && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{formError}</h3>
                </div>
              </div>
            </div>
          )}

          <div>
            <Button
              type="submit"
              disabled={isSubmitting || password.length === 0}
              className="flex w-full justify-center"
            >
              {isSubmitting ? "Processing..." : "Secure Account"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Ensure Suspense wraps useSearchParams per Next.js App Router rules
export default function SetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          Loading...
        </div>
      }
    >
      <SetPasswordContent />
    </Suspense>
  );
}
