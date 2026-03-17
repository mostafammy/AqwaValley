import { Topbar } from "../_components/layouts/Topbar";
import { GovSidebar } from "../_components/layouts/Govsidebar";
import { SidebarProvider } from "../_components/layouts/SidebarProvider";

export default function GovLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Topbar
          userName="محمد أحمد"
          userRole="GOV_ADMIN"
          userInitials="م.أ"
          portalLabel="نظام إدارة المياه · الوادي الجديد"
          notifCount={3}
        />
        <div style={{ display: "flex", flex: 1 }}>
          <GovSidebar alertCount={3} />
          <main style={{ flex: 1, padding: "22px 26px" }}>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}