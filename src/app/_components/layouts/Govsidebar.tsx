"use client";

import { usePathname } from "next/navigation";
import { NavItem, NavSectionTitle, NavDivider } from "../layouts/Navitem";
import { Badge } from "../UI/Badge";
import { useSidebar } from "./SidebarProvider";
import { api } from "~/trpc/react";
import { useEffect, useState } from "react";
import { motion, type Variants } from "framer-motion";
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
  Droplets,
} from "lucide-react";

export function GovSidebar() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const syncDesktopState = () => setIsDesktop(mediaQuery.matches);

    syncDesktopState();
    mediaQuery.addEventListener("change", syncDesktopState);

    return () => {
      mediaQuery.removeEventListener("change", syncDesktopState);
    };
  }, []);

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

  const sidebarVariants: Variants = {
    closed: { x: "100%", opacity: 0 },
    open: {
      x: 0,
      opacity: 1,
      transition: { type: "spring" as const, stiffness: 350, damping: 35 },
    },
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`fixed inset-0 top-[var(--topbar-height)] z-[1100] bg-black/20 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${isMobileOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={closeMobile}
        aria-hidden="true"
      />

      <motion.aside
        initial={false}
        animate={isDesktop || isMobileOpen ? "open" : "closed"}
        variants={sidebarVariants}
        className={`fixed top-[var(--topbar-height)] right-0 z-[1200] flex h-[calc(100dvh-var(--topbar-height))] w-[260px] flex-col border-l border-white/5 bg-[#0A1628]/95 shadow-2xl backdrop-blur-2xl lg:shrink-0 lg:translate-x-0 lg:opacity-100 lg:shadow-none ${!isMobileOpen && "hidden lg:flex"}`}
      >
        <div className="flex h-20 items-center justify-center border-b border-white/5 px-6 pt-4 pb-2">
          <div className="flex items-center gap-3 text-xl font-extrabold tracking-tight text-white">
            <div className="rounded-xl bg-sky-500/20 p-2 ring-1 ring-sky-400/30">
              <Droplets
                size={24}
                className="text-sky-400 drop-shadow-sm"
                strokeWidth={2.5}
              />
            </div>
            <span>المركز الحكومي</span>
          </div>
        </div>

        <div className="scrollbar-hide flex-1 overflow-y-auto px-2 py-6">
          <NavSectionTitle>لوحة التحكم</NavSectionTitle>

          <NavItem
            href="/dashboard"
            icon={<LayoutDashboard size={20} strokeWidth={2.5} />}
            label="الرئيسية"
            active={is("/dashboard")}
          />
          <NavItem
            href="/map"
            icon={<Map size={20} strokeWidth={2.5} />}
            label="خريطة الآبار"
            active={is("/map")}
          />
          <NavItem
            href="/alerts"
            icon={<Bell size={20} strokeWidth={2.5} />}
            label="التنبيهات"
            active={is("/alerts")}
            badge={
              alertCount > 0 ? (
                <Badge
                  variant="danger"
                  className="mr-auto ml-0 animate-pulse px-2 py-0.5 text-[10px]"
                >
                  {alertCount}
                </Badge>
              ) : undefined
            }
          />

          <NavDivider />

          <NavSectionTitle>إدارة المياه</NavSectionTitle>

          <NavItem
            href="/districts"
            icon={<Building2 size={20} strokeWidth={2.5} />}
            label="المراكز والآبار"
            active={is("/districts") || is("/wells")}
          />

          <NavItem
            href="/distribution"
            icon={<BarChart3 size={20} strokeWidth={2.5} />}
            label="توزيع المياه"
            active={is("/distribution")}
          />
          <NavItem
            href="/forecast"
            icon={<TrendingUp size={20} strokeWidth={2.5} />}
            label="توقعات الخزان"
            active={is("/forecast")}
          />

          <NavDivider />

          <NavSectionTitle>الإدارة</NavSectionTitle>

          <NavItem
            href="/reports"
            icon={<FileText size={20} strokeWidth={2.5} />}
            label="التقارير"
            active={is("/reports")}
          />
          <NavItem
            href="/users"
            icon={<Users size={20} strokeWidth={2.5} />}
            label="المستخدمون"
            active={is("/users")}
          />
          <NavItem
            href="/settings"
            icon={<Settings size={20} strokeWidth={2.5} />}
            label="الإعدادات"
            active={is("/settings")}
          />
        </div>

        {/* Subtle decorative glow at the bottom */}
        <div className="pointer-events-none absolute right-0 bottom-0 h-32 w-full bg-gradient-to-t from-blue-900/20 to-transparent" />
      </motion.aside>
    </>
  );
}
