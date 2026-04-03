import { redirect } from "next/navigation";
import { Topbar } from "../_components/layouts/Topbar";
import { GovSidebar } from "../_components/layouts/Govsidebar";
import { SidebarProvider } from "../_components/layouts/SidebarProvider";
import { getSession } from "~/server/better-auth/server";
import { getUserRolePath } from "~/app/_actions/auth";
import { ScrollReset } from "~/app/_components/layouts/ScrollReset";
import Footer from "../_components/layouts/Footer";

/**
 * Layout component that enforces government-portal access and renders the portal chrome around its children.
 *
 * If there is no authenticated user or the user's role path is not "/dashboard", the component redirects to the root path ("/").
 *
 * @param children - Content to render inside the layout's main area
 * @returns A React element containing the Topbar, GovSidebar, and the provided children wrapped by SidebarProvider
 */
export default async function GovLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Validate session is present
  const session = await getSession();
  if (!session?.user) redirect("/");

  // Validate user has Gov portal privileges
  const rolePath = await getUserRolePath();
  if (rolePath !== "/dashboard") redirect("/");

  // Prepare UI variables from session
  const name = session.user.name ?? "مستخدم";
  const parts = name.trim().split(" ");
  const initials =
    parts.length > 1
      ? `${parts[0]?.[0] ?? ""}.${parts[parts.length - 1]?.[0] ?? ""}`
      : (name[0] ?? "U");

  return (
    <SidebarProvider>
      <div className="layout-root">
        <ScrollReset />
        <Topbar
          userName={name}
          userRole="GOV_ADMIN" // Representing the operating portal context
          userInitials={initials}
          portalLabel="نظام إدارة المياه · الوادي الجديد"
        />
        <div className="layout-content-row">
          <GovSidebar />
          <main className="layout-main">{children}</main>
        </div>
        <Footer />
      </div>
    </SidebarProvider>
  );
}
