import { redirect } from "next/navigation";
import { Topbar } from "../_components/layouts/Topbar";
import { GovSidebar } from "../_components/layouts/Govsidebar";
import { SidebarProvider } from "../_components/layouts/SidebarProvider";
import { getSession } from "~/server/better-auth/server";
import { getUserRolePath } from "~/app/_actions/auth";

export default async function GovLayout({ children }: { children: React.ReactNode }) {
  // Validate session is present
  const session = await getSession();
  if (!session?.user) redirect("/");

  // Validate user has Gov portal privileges
  const rolePath = await getUserRolePath();
  if (rolePath !== "/dashboard") redirect("/");

  // Prepare UI variables from session
  const name = session.user.name || "مستخدم";
  const parts = name.trim().split(" ");
  const initials = parts.length > 1 
    ? `${parts[0]?.[0] || ""}.${parts[parts.length - 1]?.[0] || ""}` 
    : (name[0] || "U");

  return (
    <SidebarProvider>
      <div className="layout-root">
        <Topbar
          userName={name}
          userRole="GOV_ADMIN" // Representing the operating portal context
          userInitials={initials}
          portalLabel="نظام إدارة المياه · الوادي الجديد"
          notifCount={3}
        />
        <div className="layout-content-row">
          <GovSidebar alertCount={3} />
          <main className="layout-main">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}