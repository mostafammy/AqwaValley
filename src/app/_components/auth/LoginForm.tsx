"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Droplets, Loader2, User, Lock } from "lucide-react";
import { authClient } from "~/server/better-auth/client";
import { getUserRolePath } from "~/app/_actions/auth";
import { motion, AnimatePresence } from "framer-motion";

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
  const [isFocused, setIsFocused] = useState<string | null>(null);
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="card shadow-2xl shadow-blue/10 border-white/20 mx-auto w-full max-w-[400px] overflow-hidden rounded-[2rem] bg-white/80 backdrop-blur-xl p-0 ring-1 ring-black/5"
      data-testid="login-card"
    >
      <div className="relative bg-navy overflow-hidden p-10 text-center">
        {/* Subtle glowing orb in background */}
        <div className="absolute -top-1/2 left-1/2 h-full w-[150%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.15),transparent_70%)] pointer-events-none" />
        
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 20 }}
          className="relative mb-6 flex justify-center"
        >
          <div className="bg-navy flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 shadow-lg ring-4 ring-navy-3/20 shadow-blue-500/20">
            <Droplets className="h-8 w-8 text-sky-400" strokeWidth={2.5} />
          </div>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative mb-2 text-2xl font-bold tracking-tight text-white"
          data-testid="login-title"
        >
          أكوا الوادي
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-white/60 relative text-sm font-medium"
          data-testid="login-subtitle"
        >
          بوابة الدخول الموحدة
        </motion.p>
      </div>

      <div className="p-8 sm:p-10 pt-8 relative">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ height: 0, opacity: 0, y: -10 }}
              animate={{ height: "auto", opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -10 }}
              className="bg-red-50 text-red-600 border-red-100 mb-6 flex items-center gap-3 rounded-2xl border p-4 text-sm font-semibold shadow-sm"
            >
              <div className="bg-red-100 rounded-full p-1 shrink-0">
                <Image
                  src="/svg/alert-circle.svg"
                  width={16}
                  height={16}
                  className="h-4 w-4 opacity-80"
                  alt=""
                />
              </div>
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <form
          onSubmit={handleLogin}
          className="space-y-5"
          data-testid="login-form"
        >
          <div className="space-y-2">
            <label
              className="text-slate-600 ml-1 block text-sm font-semibold tracking-wide"
              htmlFor="national-id-input"
            >
              الرقم القومي
            </label>
            <div className="relative group">
              <User className={`absolute top-1/2 right-4 h-5 w-5 -translate-y-1/2 transition-colors duration-300 ${isFocused === 'national-id' ? 'text-navy' : 'text-slate-400'}`} />
              <input
                id="national-id-input"
                data-testid="national-id-input"
                type="text"
                value={nationalId}
                onFocus={() => setIsFocused('national-id')}
                onBlur={() => setIsFocused(null)}
                onChange={(e) => setNationalId(e.target.value)}
                placeholder="أدخل الرقم القومي الخاص بك"
                className="bg-slate-50/50 text-slate-800 placeholder:text-slate-400 w-full rounded-2xl border-0 ring-1 ring-black/5 px-4 py-3.5 pr-12 text-md transition-all duration-300 outline-none focus:bg-white focus:ring-2 focus:ring-navy focus:shadow-md"
                dir="ltr"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between ml-1">
              <label
                className="text-slate-600 block text-sm font-semibold tracking-wide"
                htmlFor="password-input"
              >
                كلمة المرور
              </label>
            </div>
            <div className="relative group">
              <Lock className={`absolute top-1/2 right-4 h-5 w-5 -translate-y-1/2 transition-colors duration-300 ${isFocused === 'password' ? 'text-navy' : 'text-slate-400'}`} />
              <input
                id="password-input"
                data-testid="password-input"
                type="password"
                value={password}
                onFocus={() => setIsFocused('password')}
                onBlur={() => setIsFocused(null)}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-slate-50/50 text-slate-800 placeholder:text-slate-400 w-full rounded-2xl border-0 ring-1 ring-black/5 px-4 py-3.5 pr-12 text-md transition-all duration-300 outline-none focus:bg-white focus:ring-2 focus:ring-navy focus:shadow-md"
                dir="ltr"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="pt-4">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              className="bg-navy hover:bg-navy-3 text-white flex w-full justify-center rounded-2xl py-4 !text-base !font-bold transition-all duration-300 shadow-lg shadow-navy-3/30 disabled:opacity-70 disabled:hover:scale-100 disabled:cursor-not-allowed"
              data-testid="login-submit"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "تسجيل الدخول"
              )}
            </motion.button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
