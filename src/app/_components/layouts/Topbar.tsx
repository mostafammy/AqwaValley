"use client";

import { type UserRole } from "~/lib/types";
import { Bell, Droplets, Menu, Search, Settings } from "lucide-react";
import { useSidebar } from "./SidebarProvider";
import { useState } from "react";

const ROLE_LABELS: Record<string, string> = {
  GOV_ADMIN: "مسؤول حكومي",
  SUPER_ADMIN: "مدير النظام",
  FARMER: "مزارع",
};

interface TopbarProps {
  userName?: string;
  userRole?: UserRole;
  userInitials?: string;
  portalLabel?: string;
  notifCount?: number;
  weatherChip?: string; // للـ farm portal فقط
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
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Wire up actual search routing here
    console.log("Searching for:", searchTerm);
  };

  const handleNotifClick = () => {
    // TODO: Open notifications panel here
    console.log("Opening notifications...");
  };

  const roleLabel = ROLE_LABELS[userRole] || userRole;

  return (
    <header className="topbar">
      {/* ── Right side: Logo, Title & Mobile Menu ── */}
      <div className="flex items-center gap-3">
        {/* Mobile menu toggle (visible only on small screens) */}
        <button
          onClick={toggleMobile}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border-none bg-transparent transition-colors hover:bg-white/10 md:hidden"
        >
          <Menu className="h-5 w-5 text-white" />
        </button>

        <div className="topbar-logo-bg">
          {isGov ? (
            <Droplets className="h-6 w-6 text-white" strokeWidth={1.8} />
          ) : (
            <span className="text-xl">🌾</span>
          )}
        </div>
        <div className="hidden flex-col pr-2 sm:flex">
          <h1 className="topbar-title">أكوا الوادي</h1>
          <p className="topbar-subtitle">{portalLabel}</p>
        </div>
      </div>

      {/* ── Center: Search ── */}
      <div className="hidden flex-1 items-center justify-center px-6 lg:flex">
        <form onSubmit={handleSearch} className="relative w-full max-w-sm">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث عن بئر أو منطقة..."
            className="topbar-search-input"
          />
          <button
            type="submit"
            className="pointer-events-auto absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer border-none bg-transparent"
          >
            <Search className="text-light-text h-4 w-4 transition-colors hover:text-white" />
          </button>
        </form>
      </div>

      {/* ── Left side: Icons & Profile ── */}
      <div className="mr-auto flex items-center gap-4">
        {weatherChip && (
          <div className="hidden items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 sm:flex">
            {weatherChip}
          </div>
        )}

        <div className="flex items-center gap-2 rtl:space-x-reverse">
          <button
            className="topbar-icon-btn relative"
            onClick={handleNotifClick}
            aria-label="عرض الإشعارات"
          >
            <Bell className="h-4 w-4" />
            {notifCount > 0 && (
              <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-(--color-danger) outline-2 outline-(--color-navy)"></span>
            )}
          </button>
          <button
            className="topbar-icon-btn hidden sm:flex"
            aria-label="الإعدادات"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>

        {/* Divider */}
        <div className="bg-border-2 hidden h-8 w-px sm:block"></div>

        {/* Profile */}
        <div className="flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-80">
          <div className="hidden flex-col items-end sm:flex">
            <span className="text-xs font-semibold text-white">{userName}</span>
            <span className="topbar-subtitle">{roleLabel}</span>
          </div>
          <div className="topbar-profile-avatar">{userInitials}</div>
        </div>
      </div>
    </header>
  );
}
