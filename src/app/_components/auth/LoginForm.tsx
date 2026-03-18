"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Droplets, Loader2, User, Lock } from "lucide-react";
import { authClient } from "~/server/better-auth/client";
import { getUserRolePath } from "~/app/_actions/auth";

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
    const { error: signInError } = await authClient.signIn.username({
      username: nationalId,
      password: password,
      rememberMe: false,
    });

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
    } catch (err) {
      setError("حدث خطأ أثناء فحص الصلاحيات.");
      setIsLoading(false);
    }
  };

  return (
    <div className="card w-full max-w-sm mx-auto z-10 shadow-modal p-0 overflow-hidden border-border-2">
      
      
      <div className="bg-navy p-8 text-center relative border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(29,111,168,0.2),transparent_100%)]"></div>
        <div className="relative flex justify-center mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-3 border border-white/10 shadow-lg">
            <Droplets className="h-6 w-6 text-white" strokeWidth={2} />
          </div>
        </div>
        <h1 className="relative text-xl font-bold text-white mb-1">أكوا الوادي</h1>
        <p className="relative text-light-text text-sm">بوابة الدخول الموحدة</p>
      </div>

      <div className="p-8 bg-white">
        {error && (
          <div className="mb-5 p-3 rounded-lg bg-danger-bg text-danger-text text-sm border border-danger/20 flex items-center gap-2 font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text mb-3 block">الرقم القومي</label>
            <div className="relative">
              <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <input
                type="text"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                placeholder="أدخل الرقم القومي الخاص بك"
                className="w-full rounded-md border border-border-2 bg-bg px-4 py-2.5 pr-10 text-sm text-text outline-none transition-colors focus:border-blue focus:bg-white"
                dir="ltr"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-text block">كلمة المرور</label>
            </div>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-md border border-border-2 bg-bg px-4 py-2.5 pr-10 text-sm text-text outline-none transition-colors focus:border-blue focus:bg-white"
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
              className="btn btn-primary btn-lg w-full flex justify-center text-sm! font-bold!"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "تسجيل الدخول"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
