import { redirect } from "next/navigation";
import { getUserRolePath } from "~/app/_actions/auth";
import { LoginForm } from "~/app/_components/auth/LoginForm";

/**
 * Render the root login page and redirect authenticated users to their role-specific portal.
 *
 * On server render, determines the user's role path and, if one exists, performs a server-side
 * redirect to that path. If no redirect is required, renders the unified login UI.
 *
 * @returns The page JSX containing the login layout and `LoginForm` component.
 */
export default async function RootLoginPage() {
  // If the user already has a valid session, instantly route them
  // to their designated portal via the server action logic.
  const redirectPath = await getUserRolePath();

  if (redirectPath) {
    redirect(redirectPath);
  }

  // Otherwise, render the main unified login form.
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 selection:bg-sky-200/50">
      {/* Decorative Background layers - Apple-esque Abstract Mesh gradients */}
      <div className="pointer-events-none absolute top-[-10%] left-[-10%] h-[40%] w-[40%] rounded-full bg-sky-200/40 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-10%] bottom-[-10%] h-[40%] w-[40%] rounded-full bg-blue-200/30 blur-[120px]" />
      <div className="pointer-events-none absolute top-[20%] right-[10%] h-[30%] w-[30%] rounded-full bg-indigo-200/30 blur-[100px]" />

      {/* Subtle grid pattern for texture */}
      <div className="pointer-events-none absolute inset-0 bg-[url('/svg/grid.svg')] opacity-[0.02]" />

      <div className="relative z-10 w-full">
        <LoginForm />
      </div>
    </main>
  );
}
