"use client";

import { type UserRole } from "~/lib/types";
import { Bell, Droplets, Menu, Search, Settings } from "lucide-react";
import { useSidebar } from "./SidebarProvider";

interface TopbarProps {
  userName?: string;
  userRole?: UserRole;
  userInitials?: string;
  portalLabel?: string;
  notifCount?: number;
  weatherChip?: string;     // للـ farm portal فقط
}

export function Topbar({
  userName = "محمد أحمد",
  userRole = "GOV_ADMIN",
  userInitials = "م.أ",
  portalLabel = "نظام إدارة الموارد المائية",
  notifCount = 0,
  weatherChip,
}: TopbarProps) {
  const isGov = userRole === "GOV_ADMIN" || userRole === "SUPER_ADMIN";
  const { toggleMobile } = useSidebar();

  return (
    <header className="topbar">
      
      {/* ── Right side: Logo, Title & Mobile Menu ── */}
      <div className="flex items-center gap-3">
        {/* Mobile menu toggle (visible only on small screens) */}
        <button onClick={toggleMobile} className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-white/10 transition-colors md:hidden cursor-pointer border-none bg-transparent">
          <Menu className="h-5 w-5 text-white" />
        </button>

        <div className="topbar-logo-bg">
          {isGov ? (
            <Droplets className="h-6 w-6 text-white" strokeWidth={1.8} />
          ) : (
            <span className="text-xl">🌾</span>
          )}
        </div>
        <div className="hidden flex-col sm:flex pr-2">
          <h1 className="topbar-title">أكوا الوادي</h1>
          <p className="topbar-subtitle">{portalLabel}</p>
        </div>
      </div>

      {/* ── Center: Search ── */}
      <div className="hidden flex-1 items-center justify-center lg:flex px-6">
        <div className="relative w-full max-w-sm">
          <input
            type="text"
            placeholder="بحث عن بئر أو منطقة..."
            className="topbar-search-input"
          />
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-light-text pointer-events-none" />
        </div>
      </div>

      {/* ── Left side: Icons & Profile ── */}
      <div className="flex items-center gap-4 mr-auto">
        {weatherChip && (
          <div className="hidden sm:flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full text-xs font-medium text-white/90">
            {weatherChip}
          </div>
        )}

        <div className="flex items-center gap-2 rtl:space-x-reverse">
          <button className="topbar-icon-btn relative">
            <Bell className="h-4 w-4" />
            {notifCount > 0 && <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-(--color-danger) outline-2 outline-(--color-navy)"></span>}
          </button>
          <button className="topbar-icon-btn hidden sm:flex">
            <Settings className="h-4 w-4" />
          </button>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-border-2 hidden sm:block"></div>

        {/* Profile */}
        <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
          <div className="hidden flex-col items-end sm:flex">
            <span className="text-xs font-semibold text-white">{userName}</span>
            <span className="topbar-subtitle">{userRole}</span>
          </div>
          <div className="topbar-profile-avatar">
            {userInitials}
          </div>
        </div>
      </div>

    </header>
  );
}