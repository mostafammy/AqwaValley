"use client";

import { usePathname } from "next/navigation";
import { NavItem, NavSectionTitle, NavDivider } from "../layouts/Navitem";
import { Badge } from "../UI/Badge";
import { useSidebar } from "./SidebarProvider";
import { api } from "~/trpc/react";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Map,
  Bell,
  Building2,
  BarChart3,
  TrendingUp,
  FileText,
  Users,
  Settings,
} from "lucide-react";

export function GovSidebar() {
  const pathname = usePathname();
  const is = (path: string) =>
    path === "/"
      ? pathname === path
      : pathname === path || pathname.startsWith(`${path}/`);

  const { isMobileOpen, closeMobile } = useSidebar();

  // Fetch unacknowledged alert count reactively via tRPC
  const { data: alertCount = 0, error } = api.alerts.count.useQuery(undefined, {
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Debug: Log errors
  useEffect(() => {
    if (error) {
      console.error("Alert count query error:", error);
    }
  }, [error]);

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
          icon={<LayoutDashboard size={18} />}
          label="الرئيسية"
          active={is("/dashboard")}
        />
        <NavItem
          href="/map"
          icon={<Map size={18} />}
          label="خريطة الآبار"
          active={is("/map")}
        />
        <NavItem
          href="/alerts"
          icon={<Bell size={18} />}
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
          icon={<Building2 size={18} />}
          label="المراكز والآبار"
          active={is("/districts") || is("/wells")}
        />

        <NavItem
          href="/distribution"
          icon={<BarChart3 size={18} />}
          label="توزيع المياه"
          active={is("/distribution")}
        />
        <NavItem
          href="/forecast"
          icon={<TrendingUp size={18} />}
          label="توقعات الخزان"
          active={is("/forecast")}
        />

        <NavDivider />

        <NavSectionTitle>الإدارة</NavSectionTitle>

        <NavItem
          href="/reports"
          icon={<FileText size={18} />}
          label="التقارير"
          active={is("/reports")}
        />
        <NavItem
          href="/users"
          icon={<Users size={18} />}
          label="المستخدمون"
          active={is("/users")}
        />
        <NavItem
          href="/settings"
          icon={<Settings size={18} />}
          label="الإعدادات"
          active={is("/settings")}
        />
      </aside>
    </>
  );
}
