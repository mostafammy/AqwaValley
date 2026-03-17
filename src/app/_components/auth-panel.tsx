"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  maskNationalId,
  nationalIdSchema,
  normalizeNationalIdInput,
} from "~/lib/national-id";
import { authClient } from "~/server/better-auth/client";

type AuthMode = "sign-in" | "sign-up";

type SignInFormState = {
  nationalId: string;
  password: string;
};

type SignUpFormState = {
  name: string;
  email: string;
  nationalId: string;
  password: string;
};

const defaultSignInState: SignInFormState = {
  nationalId: "",
  password: "",
};

const defaultSignUpState: SignUpFormState = {
  name: "",
  email: "",
  nationalId: "",
  password: "",
};

export function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [signInForm, setSignInForm] = useState(defaultSignInState);
  const [signUpForm, setSignUpForm] = useState(defaultSignUpState);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const updateMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleSignIn = () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const parsedNationalId = nationalIdSchema.safeParse(signInForm.nationalId);
    if (!parsedNationalId.success) {
      setErrorMessage(
        parsedNationalId.error.issues[0]?.message ?? "Invalid National ID",
      );
      return;
    }

    if (!signInForm.password) {
      setErrorMessage("Password is required");
      return;
    }

    startTransition(async () => {
      const { error } = await authClient.signIn.username({
        username: parsedNationalId.data,
        password: signInForm.password,
      });

      if (error) {
        setErrorMessage(error.message ?? "Unable to sign in");
        return;
      }

      router.refresh();
    });
  };

  const handleSignUp = () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const parsedNationalId = nationalIdSchema.safeParse(signUpForm.nationalId);
    if (!parsedNationalId.success) {
      setErrorMessage(
        parsedNationalId.error.issues[0]?.message ?? "Invalid National ID",
      );
      return;
    }

    if (!signUpForm.name.trim()) {
      setErrorMessage("Full name is required");
      return;
    }

    if (!signUpForm.email.trim()) {
      setErrorMessage("Recovery email is required");
      return;
    }

    if (signUpForm.password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long");
      return;
    }

    startTransition(async () => {
      const { error } = await authClient.signUp.email({
        name: signUpForm.name.trim(),
        email: signUpForm.email.trim(),
        password: signUpForm.password,
        username: parsedNationalId.data,
        displayUsername: maskNationalId(parsedNationalId.data),
      });

      if (error) {
        setErrorMessage(error.message ?? "Unable to create your account");
        return;
      }

      setSuccessMessage("Account created successfully");
      router.refresh();
    });
  };

  return (
    <section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-black/20 p-6 backdrop-blur">
      <div className="flex items-center gap-2 rounded-full bg-white/5 p-1">
        <button
          type="button"
          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
            mode === "sign-in" ? "bg-white text-slate-950" : "text-white/70"
          }`}
          onClick={() => updateMode("sign-in")}
        >
          Sign in
        </button>
        <button
          type="button"
          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
            mode === "sign-up" ? "bg-white text-slate-950" : "text-white/70"
          }`}
          onClick={() => updateMode("sign-up")}
        >
          Register
        </button>
      </div>

      <div className="mt-6 space-y-4">
        {mode === "sign-in" ? (
          <>
            <Field
              label="National ID"
              value={signInForm.nationalId}
              onChange={(value) =>
                setSignInForm((current) => ({
                  ...current,
                  nationalId: normalizeNationalIdInput(value),
                }))
              }
              placeholder="Enter your national ID"
            />
            <PasswordField
              value={signInForm.password}
              onChange={(value) =>
                setSignInForm((current) => ({ ...current, password: value }))
              }
            />
            <button
              type="button"
              className="w-full rounded-full bg-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isPending}
              onClick={handleSignIn}
            >
              {isPending ? "Signing in..." : "Sign in securely"}
            </button>
          </>
        ) : (
          <>
            <Field
              label="Full name"
              value={signUpForm.name}
              onChange={(value) =>
                setSignUpForm((current) => ({ ...current, name: value }))
              }
              placeholder="Enter your full name"
            />
            <Field
              label="Recovery email"
              type="email"
              value={signUpForm.email}
              onChange={(value) =>
                setSignUpForm((current) => ({ ...current, email: value }))
              }
              placeholder="Enter your recovery email"
            />
            <Field
              label="National ID"
              value={signUpForm.nationalId}
              onChange={(value) =>
                setSignUpForm((current) => ({
                  ...current,
                  nationalId: normalizeNationalIdInput(value),
                }))
              }
              placeholder="Enter your national ID"
            />
            <PasswordField
              value={signUpForm.password}
              onChange={(value) =>
                setSignUpForm((current) => ({ ...current, password: value }))
              }
            />
            <button
              type="button"
              className="w-full rounded-full bg-amber-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isPending}
              onClick={handleSignUp}
            >
              {isPending ? "Creating account..." : "Create account"}
            </button>
          </>
        )}

        {errorMessage ? (
          <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {errorMessage}
          </p>
        ) : null}
        {successMessage ? (
          <p className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {successMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: "email" | "password" | "text";
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: FieldProps) {
  return (
    <label className="block space-y-2 text-sm text-white/80">
      <span className="font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white transition outline-none placeholder:text-white/30 focus:border-cyan-300/60"
      />
    </label>
  );
}

function PasswordField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field
      label="Password"
      type="password"
      value={value}
      onChange={onChange}
      placeholder="Enter your password"
    />
  );
}
