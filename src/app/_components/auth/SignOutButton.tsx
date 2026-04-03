"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

interface SignOutButtonProps {
  children: React.ReactNode;
  className?: string;
}

export function SignOutButton({ children, className }: SignOutButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      try {
        const { authClient } = await import("~/server/better-auth/client");
        await authClient.signOut();
        router.push("/");
        router.refresh();
      } catch (error) {
        console.error("Sign out error:", error);
        window.location.href = "/";
      }
    });
  };

  return (
    <button onClick={handleSignOut} disabled={isPending} className={className}>
      {isPending ? "جاري..." : children}
    </button>
  );
}
