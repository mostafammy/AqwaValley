import { Topbar } from "../_components/layouts/Topbar";
import { SidebarProvider } from "../_components/layouts/SidebarProvider";
import { GovSidebar } from "../_components/layouts/Govsidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Topbar 
          userName="مختبر المكونات"
          userRole="GOV_ADMIN"
          userInitials="م"
          portalLabel="بيئة الاختبار والتطوير"
          notifCount={2}
        />
        <div style={{ display: "flex", flex: 1 }}>
          <GovSidebar alertCount={2} />
          <main style={{ flex: 1, padding: "22px" }}>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}