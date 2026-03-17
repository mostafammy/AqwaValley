"use client";

import { usePathname } from "next/navigation";
import { NavItem, NavSectionTitle, NavDivider } from "../layouts/Navitem";
import { useSidebar } from "./SidebarProvider";

export function FarmSidebar() {
  const pathname = usePathname();
  const is = (path: string) => pathname === path;
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
        icon="🏠"
        label="الرئيسية"
        active={is("/farm/dashboard")}
      />
      <NavItem
        href="/farm/crops"
        icon="🌱"
        label="بروفايل المحاصيل"
        active={is("/farm/crops")}
      />
      <NavItem
        href="/farm/soil"
        icon="🌡️"
        label="قراءات التربة"
        active={is("/farm/soil")}
      />

      <NavDivider />

      <NavSectionTitle>الري</NavSectionTitle>

      <NavItem
        href="/farm/ai-plan"
        icon="🤖"
        label="خطة الري الذكي"
        active={is("/farm/ai-plan")}
      />
      <NavItem
        href="/farm/irrigate"
        icon="💧"
        label="تشغيل الري"
        active={is("/farm/irrigate")}
      />
      <NavItem
        href="/farm/history"
        icon="📅"
        label="سجل الري"
        active={is("/farm/history")}
      />
      <NavItem
        href="/farm/quota"
        icon="🪣"
        label="الحصة المائية"
        active={is("/farm/quota")}
      />

    </aside>
    </>
  );
}