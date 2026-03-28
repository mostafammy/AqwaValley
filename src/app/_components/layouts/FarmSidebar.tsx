"use client";

import { usePathname } from "next/navigation";
import { NavItem, NavSectionTitle, NavDivider } from "../layouts/Navitem";
import { useSidebar } from "./SidebarProvider";
import {
  LayoutDashboard,
  Leaf,
  FlaskConical,
  Sparkles,
  PlayCircle,
  History,
  Scale,
} from "lucide-react";

export function FarmSidebar() {
  const pathname = usePathname();
  const is = (path: string) =>
    path === "/"
      ? pathname === path
      : pathname === path || pathname.startsWith(`${path}/`);
  const { isMobileOpen, closeMobile } = useSidebar();

  return (
    <>
      <div
        className={`sidebar-overlay ${isMobileOpen ? "open" : ""}`}
        onClick={closeMobile}
      />

      <aside className={`sidebar ${isMobileOpen ? "sidebar-open" : ""}`}>
        <NavSectionTitle>مزرعتي</NavSectionTitle>

        <NavItem
          href="/farm/dashboard"
          icon={<LayoutDashboard size={18} />}
          label="الرئيسية"
          active={is("/farm/dashboard")}
        />
        <NavItem
          href="/farm/crops"
          icon={<Leaf size={18} />}
          label="بروفايل المحاصيل"
          active={is("/farm/crops")}
        />
        <NavItem
          href="/farm/soil"
          icon={<FlaskConical size={18} />}
          label="قراءات التربة"
          active={is("/farm/soil")}
        />

        <NavDivider />

        <NavSectionTitle>الري</NavSectionTitle>

        <NavItem
          href="/farm/ai-plan"
          icon={<Sparkles size={18} />}
          label="خطة الري الذكي"
          active={is("/farm/ai-plan")}
        />
        <NavItem
          href="/farm/irrigate"
          icon={<PlayCircle size={18} />}
          label="تشغيل الري"
          active={is("/farm/irrigate")}
        />
        <NavItem
          href="/farm/history"
          icon={<History size={18} />}
          label="سجل الري"
          active={is("/farm/history")}
        />
        <NavItem
          href="/farm/quota"
          icon={<Scale size={18} />}
          label="الحصة المائية"
          active={is("/farm/quota")}
        />
      </aside>
    </>
  );
}
