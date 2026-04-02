"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Droplets, Loader2, User, Lock } from "lucide-react";
import { authClient } from "~/server/better-auth/client";
import { getUserRolePath } from "~/app/_actions/auth";

/**
 * Renders the login form UI and handles user authentication and role-based redirect.
 *
 * The component presents inputs for national ID and password, shows validation and
 * authentication errors, displays a loading state during submission, and navigates
 * the user to an appropriate post-login path when authentication and role lookup succeed.
 *
 * @returns A React element that renders the login form and its associated behavior.
 */
export function LoginForm() {
  const [nationalId, setNationalId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Use Better Auth's username plugin (National ID = username)
    let signInError;
    try {
      const result = await authClient.signIn.username({
        username: nationalId,
        password: password,
        rememberMe: false,
      });
      signInError = result.error;
    } catch {
      setError("حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى.");
      setIsLoading(false);
      return;
    }

    if (signInError) {
      // Basic error message handling
      setError("الرقم القومي أو كلمة المرور غير صحيحة.");
      setIsLoading(false);
      return;
    }
    // Lookup role after successful session creation
    try {
      const redirectPath = await getUserRolePath();
      if (redirectPath) {
        router.push(redirectPath);
      } else {
        setError("عذراً، لا تملك الصلاحيات الكافية للوصول.");
        setIsLoading(false);
      }
    } catch {
      setError("حدث خطأ أثناء فحص الصلاحيات.");
      setIsLoading(false);
    }
  };

  return (
    <div
      className="card shadow-modal border-border-2 z-10 mx-auto w-full max-w-sm overflow-hidden p-0"
      data-testid="login-card"
    >
      <div className="bg-navy border-border relative border-b p-8 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(29,111,168,0.2),transparent_100%)]"></div>
        <div className="relative mb-4 flex justify-center">
          <div className="bg-navy-3 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 shadow-lg">
            <Droplets className="h-6 w-6 text-white" strokeWidth={2} />
          </div>
        </div>
        <h1 className="relative mb-1 text-xl font-bold text-white" data-testid="login-title">
          أكوا الوادي
        </h1>
        <p className="text-light-text relative text-sm" data-testid="login-subtitle">
          بوابة الدخول الموحدة
        </p>
      </div>

      <div className="bg-white p-8">
        {error && (
          <div className="bg-danger-bg text-danger-text border-danger/20 mb-5 flex items-center gap-2 rounded-lg border p-3 text-sm font-medium">
            <Image
              src="/svg/alert-circle.svg"
              width={16}
              height={16}
              className="h-4 w-4 opacity-70"
              alt=""
            />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4" data-testid="login-form">
          <div className="space-y-1.5">
            <label className="text-text mb-3 block text-xs font-bold" htmlFor="national-id-input">
              الرقم القومي
            </label>
            <div className="relative">
              <User className="text-muted absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
              <input
                id="national-id-input"
                data-testid="national-id-input"
                type="text"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                placeholder="أدخل الرقم القومي الخاص بك"
                className="border-border-2 bg-bg text-text focus:border-blue w-full rounded-md border px-4 py-2.5 pr-10 text-sm transition-colors outline-none focus:bg-white"
                dir="ltr"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="mb-3 flex items-center justify-between">
              <label className="text-text block text-xs font-bold" htmlFor="password-input">
                كلمة المرور
              </label>
            </div>
            <div className="relative">
              <Lock className="text-muted absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
              <input
                id="password-input"
                data-testid="password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="border-border-2 bg-bg text-text focus:border-blue w-full rounded-md border px-4 py-2.5 pr-10 text-sm transition-colors outline-none focus:bg-white"
                dir="ltr"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary btn-lg flex w-full justify-center !text-sm !font-bold"
              data-testid="login-submit"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "تسجيل الدخول"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
