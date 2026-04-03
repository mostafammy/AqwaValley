"use client";

import { usePathname } from "next/navigation";
import { NavItem, NavSectionTitle, NavDivider } from "../layouts/Navitem";
import { Badge } from "../UI/Badge";
import { useSidebar } from "./SidebarProvider";
import { api } from "~/trpc/react";
import { useEffect } from "react";
import { motion } from "framer-motion";
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
  Droplets
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

  const sidebarVariants = {
    closed: { x: "100%", opacity: 0 },
    open: { 
      x: 0, 
      opacity: 1,
      transition: { type: "spring", stiffness: 350, damping: 35 }
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden transition-opacity duration-300 ${isMobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={closeMobile}
        aria-hidden="true"
      />

      <motion.aside 
        initial={false}
        animate={isMobileOpen ? "open" : "closed"}
        variants={sidebarVariants}
        className={`fixed top-0 right-0 bottom-0 z-50 flex flex-col w-[260px] bg-[#0A1628]/95 backdrop-blur-2xl border-l border-white/5 shadow-2xl lg:shadow-none lg:static lg:translate-x-0 lg:opacity-100 ${!isMobileOpen && "hidden lg:flex"}`}
      >
        <div className="flex h-20 items-center justify-center border-b border-white/5 pt-4 pb-2 px-6">
          <div className="text-white font-extrabold tracking-tight text-xl flex items-center gap-3">
             <div className="bg-sky-500/20 p-2 rounded-xl ring-1 ring-sky-400/30">
              <Droplets size={24} className="text-sky-400 drop-shadow-sm" strokeWidth={2.5}/>
             </div>
             <span>المركز الحكومي</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-6 scrollbar-hide">
          <NavSectionTitle>لوحة التحكم</NavSectionTitle>

          <NavItem
            href="/dashboard"
            icon={<LayoutDashboard size={20} strokeWidth={2.5}/>}
            label="الرئيسية"
            active={is("/dashboard")}
          />
          <NavItem
            href="/map"
            icon={<Map size={20} strokeWidth={2.5}/>}
            label="خريطة الآبار"
            active={is("/map")}
          />
          <NavItem
            href="/alerts"
            icon={<Bell size={20} strokeWidth={2.5}/>}
            label="التنبيهات"
            active={is("/alerts")}
            badge={
              alertCount > 0 ? (
                <Badge variant="danger" className="ml-0 mr-auto px-2 py-0.5 animate-pulse text-[10px]">{alertCount}</Badge>
              ) : undefined
            }
          />

          <NavDivider />

          <NavSectionTitle>إدارة المياه</NavSectionTitle>

          <NavItem
            href="/districts"
            icon={<Building2 size={20} strokeWidth={2.5}/>}
            label="المراكز والآبار"
            active={is("/districts") || is("/wells")}
          />

          <NavItem
            href="/distribution"
            icon={<BarChart3 size={20} strokeWidth={2.5}/>}
            label="توزيع المياه"
            active={is("/distribution")}
          />
          <NavItem
            href="/forecast"
            icon={<TrendingUp size={20} strokeWidth={2.5}/>}
            label="توقعات الخزان"
            active={is("/forecast")}
          />

          <NavDivider />

          <NavSectionTitle>الإدارة</NavSectionTitle>

          <NavItem
            href="/reports"
            icon={<FileText size={20} strokeWidth={2.5}/>}
            label="التقارير"
            active={is("/reports")}
          />
          <NavItem
            href="/users"
            icon={<Users size={20} strokeWidth={2.5}/>}
            label="المستخدمون"
            active={is("/users")}
          />
          <NavItem
            href="/settings"
            icon={<Settings size={20} strokeWidth={2.5}/>}
            label="الإعدادات"
            active={is("/settings")}
          />
        </div>
        
        {/* Subtle decorative glow at the bottom */}
        <div className="pointer-events-none absolute bottom-0 right-0 h-32 w-full bg-gradient-to-t from-blue-900/20 to-transparent" />
      </motion.aside>
    </>
  );
}
