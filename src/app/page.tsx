import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthPanel } from "~/app/_components/auth-panel";
import { LatestPost } from "~/app/_components/post";
import { auth } from "~/server/better-auth";
import { getSession } from "~/server/better-auth/server";
import { api, HydrateClient } from "~/trpc/server";

export default async function Home() {
  const hello = await api.post.hello({ text: "from tRPC" });
  const session = await getSession();

  return (
    <HydrateClient>
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.22),_transparent_32%),linear-gradient(180deg,_#04121a_0%,_#0b1f2a_50%,_#102f3f_100%)] text-white">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-12 px-6 py-16 lg:flex-row lg:items-center lg:gap-16">
          <section className="flex-1 space-y-8">
            <div className="inline-flex items-center rounded-full border border-cyan-200/20 bg-cyan-300/10 px-4 py-1 text-sm font-medium text-cyan-100">
              Aqwa Valley Identity Gateway
            </div>
            <div className="space-y-5">
              <h1 className="max-w-3xl text-5xl font-extrabold tracking-tight text-balance sm:text-6xl">
                Trusted access for citizen services.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-200/80">
                Authenticate with your national ID and password, keep a recovery
                email on file, and access protected workflows without
                third-party social accounts.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                <p className="text-sm tracking-[0.2em] text-cyan-100/70 uppercase">
                  Primary access
                </p>
                <p className="mt-3 text-xl font-semibold text-white">
                  National ID + password
                </p>
                <p className="mt-2 text-sm leading-6 text-white/65">
                  Sign in using your national identifier as the primary
                  credential.
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                <p className="text-sm tracking-[0.2em] text-amber-100/70 uppercase">
                  Recovery path
                </p>
                <p className="mt-3 text-xl font-semibold text-white">
                  Secondary email contact
                </p>
                <p className="mt-2 text-sm leading-6 text-white/65">
                  Keep a recovery address on file for password reset and service
                  notifications.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
              <Link
                className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 hover:bg-white/20"
                href="https://create.t3.gg/en/usage/first-steps"
                target="_blank"
              >
                <h3 className="text-2xl font-bold">First Steps →</h3>
                <div className="text-lg">
                  Just the basics - Everything you need to know to set up your
                  database and authentication.
                </div>
              </Link>
              <Link
                className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 hover:bg-white/20"
                href="https://create.t3.gg/en/introduction"
                target="_blank"
              >
                <h3 className="text-2xl font-bold">Documentation →</h3>
                <div className="text-lg">
                  Learn more about Create T3 App, the libraries it uses, and how
                  to deploy it.
                </div>
              </Link>
            </div>
            <p className="text-xl text-white/90">
              {hello ? hello.greeting : "Loading tRPC query..."}
            </p>
          </section>

          <section className="w-full max-w-xl space-y-6">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/30">
              <p className="text-sm tracking-[0.2em] text-white/50 uppercase">
                Session
              </p>
              <div className="mt-4 space-y-4">
                <p className="text-2xl font-semibold text-white">
                  {session
                    ? `Signed in as ${session.user?.name}`
                    : "No active session"}
                </p>
                <p className="text-sm leading-6 text-white/70">
                  {session
                    ? `Recovery email: ${session.user?.email}`
                    : "Use your national ID to sign in, or register a new account with a recovery email."}
                </p>
                {session ? (
                  <form>
                    <button
                      className="rounded-full border border-white/15 bg-white/10 px-6 py-3 font-semibold transition hover:bg-white/20"
                      formAction={async () => {
                        "use server";
                        await auth.api.signOut({
                          headers: await headers(),
                        });
                        redirect("/");
                      }}
                    >
                      Sign out
                    </button>
                  </form>
                ) : (
                  <AuthPanel />
                )}
              </div>
            </div>

            {session?.user ? <LatestPost /> : null}
          </section>
        </div>
      </main>
    </HydrateClient>
  );
}
