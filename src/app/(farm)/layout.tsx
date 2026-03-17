import { Topbar } from "../_components/layouts/Topbar";
import { FarmSidebar } from "../_components/layouts/FarmSidebar";
import { SidebarProvider } from "../_components/layouts/SidebarProvider";

export default function FarmLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Topbar
          userName="عبدالله محمد"
          userRole="FARMER"
          userInitials="ع.م"
          portalLabel="مزرعة الفرافرة — القمح والبنجر"
          notifCount={0}
          weatherChip="🌡️ 34°م ☀️ جاف"
        />
        <div style={{ display: "flex", flex: 1 }}>
          <FarmSidebar />
          <main style={{ flex: 1, padding: "22px 26px" }}>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}