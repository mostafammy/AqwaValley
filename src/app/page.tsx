import { redirect } from "next/navigation";
import { getUserRolePath } from "~/app/_actions/auth";
import { LoginForm } from "~/app/_components/auth/LoginForm";

export default async function RootLoginPage() {
  // If the user already has a valid session, instantly route them
  // to their designated portal via the server action logic.
  const redirectPath = await getUserRolePath();
  
  if (redirectPath) {
    redirect(redirectPath);
  }

  // Otherwise, render the main unified login form.
  return (
    <main className="min-h-screen flex items-center justify-center bg-bg relative px-4">
      {/* Decorative Background layer */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(29,111,168,0.06),transparent_50%)] pointer-events-none" />
      
      <div className="w-full relative">
        <LoginForm />
      </div>
    </main>
  );
}
