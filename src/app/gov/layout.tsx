import { Topbar } from "../_components/layouts/Topbar";
import { GovSidebar } from "../_components/layouts/Govsidebar";
import { SidebarProvider } from "../_components/layouts/SidebarProvider";

export default function GovLayout({ children }: { children: React.ReactNode }) {
  // TODO: Replace with real values from AuthContext or useSession hook:
  // const { user } = useAuth();
  const dummyUser = {
    name: "محمد أحمد",
    role: "GOV_ADMIN" as const,
    initials: "م.أ",
  };

  return (
    <SidebarProvider>
      <div className="layout-root">
        <Topbar
          userName={dummyUser.name}
          userRole={dummyUser.role}
          userInitials={dummyUser.initials}
          portalLabel="نظام إدارة المياه · الوادي الجديد"
          notifCount={3}
        />
        <div className="layout-content-row">
          <GovSidebar alertCount={3} />
          <main className="layout-main">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
