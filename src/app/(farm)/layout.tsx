import { redirect } from "next/navigation";
import { Topbar } from "../_components/layouts/Topbar";
import { FarmSidebar } from "../_components/layouts/FarmSidebar";
import { SidebarProvider } from "../_components/layouts/SidebarProvider";
import { getSession } from "~/server/better-auth/server";
import { getUserRolePath } from "~/app/_actions/auth";
import { ScrollReset } from "~/app/_components/layouts/ScrollReset";
/**
 * Render the farm portal layout for authenticated users with the farmer role.
 *
 * If the session is missing or the user's role path is not "/farm/dashboard", this component redirects to the root path ("/").
 *
 * @param children - Content to render inside the layout's main area.
 * @returns A React element containing the sidebar, topbar (populated from session data), and a main content area that wraps `children`.
 */
export default async function FarmLayout({ children }: { children: React.ReactNode }) {
  // Validate session is present
  const session = await getSession();
  if (!session?.user) redirect("/");

  // Validate user has Farm portal privileges
  const rolePath = await getUserRolePath();
  if (rolePath !== "/farm/dashboard") redirect("/");

  // Prepare UI variables from session
  const name = session.user.name ?? "مزارع";
  const parts = name.trim().split(" ");
  const initials = parts.length > 1 
    ? `${parts[0]?.[0] ?? ""}.${parts[parts.length - 1]?.[0] ?? ""}` 
    : (name[0] ?? "F");

  return (
    <SidebarProvider>
      <div className="layout-root">
        <ScrollReset />
        <Topbar
          userName={name}
          userRole="FARMER"
          userInitials={initials}
          portalLabel="مزرعة الفرافرة — القمح والبنجر"
          weatherChip="34°م - جاف"
        />
        <div className="layout-content-row">
          <FarmSidebar />
          <main className="layout-main">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}