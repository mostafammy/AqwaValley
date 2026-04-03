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
import Image from "next/image";
import { motion } from "framer-motion";

export function FarmSidebar() {
  const pathname = usePathname();
  const is = (path: string) =>
    path === "/"
      ? pathname === path
      : pathname === path || pathname.startsWith(`${path}/`);
  const { isMobileOpen, closeMobile } = useSidebar();

  const sidebarVariants = {
    closed: { x: "100%", opacity: 0 },
    open: {
      x: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 350, damping: 35 },
    },
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${isMobileOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={closeMobile}
        aria-hidden="true"
      />

      <motion.aside
        initial={false}
        animate={isMobileOpen ? "open" : "closed"}
        variants={sidebarVariants}
        className={`fixed top-0 right-0 bottom-0 z-50 flex w-[260px] flex-col border-l border-white/5 bg-[#0A1628]/95 shadow-2xl backdrop-blur-2xl lg:static lg:translate-x-0 lg:opacity-100 lg:shadow-none ${!isMobileOpen && "hidden lg:flex"}`}
      >
        <div className="flex h-20 items-center justify-center border-b border-white/5 px-6 pt-4 pb-2">
          <div className="flex items-center gap-3 text-xl font-extrabold tracking-tight text-white">
            <div className="rounded-xl bg-sky-500/20 p-2 ring-1 ring-sky-400/30">
              <Leaf size={24} className="text-sky-400 drop-shadow-sm" />
            </div>
            <span>أكوا الوادي</span>
          </div>
        </div>

        <div className="scrollbar-hide flex-1 overflow-y-auto px-2 py-6">
          <NavSectionTitle>مزرعتي</NavSectionTitle>

          <NavItem
            href="/farm/dashboard"
            icon={<LayoutDashboard size={20} strokeWidth={2.5} />}
            label="الرئيسية"
            active={is("/farm/dashboard")}
          />
          <NavItem
            href="/farm/crops"
            icon={<Leaf size={20} strokeWidth={2.5} />}
            label="بروفايل المحاصيل"
            active={is("/farm/crops")}
          />
          <NavItem
            href="/farm/soil"
            icon={<FlaskConical size={20} strokeWidth={2.5} />}
            label="قراءات التربة"
            active={is("/farm/soil")}
          />

          <NavDivider />

          <NavSectionTitle>الري</NavSectionTitle>

          <NavItem
            href="/farm/ai-plan"
            icon={<Sparkles size={20} strokeWidth={2.5} />}
            label="خطة الري الذكي"
            active={is("/farm/ai-plan")}
          />
          <NavItem
            href="/farm/irrigate"
            icon={<PlayCircle size={20} strokeWidth={2.5} />}
            label="تشغيل الري"
            active={is("/farm/irrigate")}
          />
          <NavItem
            href="/farm/history"
            icon={<History size={20} strokeWidth={2.5} />}
            label="سجل الري"
            active={is("/farm/history")}
          />
          <NavItem
            href="/farm/quota"
            icon={<Scale size={20} strokeWidth={2.5} />}
            label="الحصة المائية"
            active={is("/farm/quota")}
          />
        </div>

        {/* Subtle decorative glow at the bottom */}
        <div className="pointer-events-none absolute right-0 bottom-0 h-32 w-full bg-gradient-to-t from-blue-900/20 to-transparent" />
      </motion.aside>
    </>
  );
}
