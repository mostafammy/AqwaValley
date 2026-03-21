"use client";

import { usePathname } from "next/navigation";
import { NavItem, NavSectionTitle, NavDivider } from "../layouts/Navitem";
import { Badge } from "../UI/Badge";
import { useSidebar } from "./SidebarProvider";

interface GovSidebarProps {
  alertCount?: number;
}

export function GovSidebar({ alertCount = 0 }: GovSidebarProps) {
  const pathname = usePathname();
  const is = (path: string) =>
    path === "/"
      ? pathname === path
      : pathname === path || pathname.startsWith(`${path}/`);
      
  const { isMobileOpen, closeMobile } = useSidebar();

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`sidebar-overlay ${isMobileOpen ? "open" : ""}`}
        onClick={closeMobile}
      />

      <aside className={`sidebar ${isMobileOpen ? "sidebar-open" : ""}`}>
        <NavSectionTitle>لوحة التحكم</NavSectionTitle>

        <NavItem
          href="/dashboard"
          icon="🏠"
          label="الرئيسية"
          active={is("/dashboard")}
        />
        <NavItem
          href="/map"
          icon="🗺️"
          label="خريطة الآبار"
          active={is("/map")}
        />
        <NavItem
          href="/alerts"
          icon="🚨"
          label="التنبيهات"
          active={is("/alerts")}
          badge={
            alertCount > 0 ? (
              <Badge variant="danger">{alertCount}</Badge>
            ) : undefined
          }
        />

        <NavDivider />

        <NavSectionTitle>إدارة المياه</NavSectionTitle>

        <NavItem
          href="/districts"
          icon="🏛️"
          label="المراكز والآبار"
          active={is("/districts") || pathname.startsWith("/wells")}
        />
        
        <NavItem
          href="/distribution"
          icon="📊"
          label="توزيع المياه"
          active={is("/distribution")}
        />
        <NavItem
          href="/forecast"
          icon="📈"
          label="توقعات الخزان"
          active={is("/forecast")}
        />

        <NavDivider />

        <NavSectionTitle>الإدارة</NavSectionTitle>

        <NavItem
          href="/reports"
          icon="📄"
          label="التقارير"
          active={is("/reports")}
        />
        <NavItem
          href="/users"
          icon="👥"
          label="المستخدمون"
          active={is("/users")}
        />
        <NavItem
          href="/settings"
          icon="⚙️"
          label="الإعدادات"
          active={is("/settings")}
        />
      </aside>
    </>
  );
}
