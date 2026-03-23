"use client";
import { type UserRole } from "~/lib/types";
import { Bell, Droplets, LogOut, Menu, Search, Settings, ChevronDown } from "lucide-react";
import { useSidebar } from "./SidebarProvider";
import { useState, useRef, useEffect } from "react";
import { authClient } from "~/server/better-auth/client";
import { useRouter } from "next/navigation";
import { NotificationDropdown } from "./NotificationDropdown";

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

/**
 * Renders the portal's top navigation bar including branding, search, notifications, settings, and a user profile dropdown.
 *
 * @param userName - Display name shown in the profile area (default: "محمد أحمد")
 * @param userRole - User role key; controls role label and branding variant (e.g., GOV_ADMIN, SUPER_ADMIN, FARMER)
 * @param userInitials - Initials shown inside the avatar circle
 * @param portalLabel - Subtitle shown under the portal title
 * @param notifCount - Number of unread notifications; a small indicator is shown when greater than zero
 * @param weatherChip - Optional small badge (e.g., current weather) rendered next to icons when provided
 * @returns The top-level JSX element for the portal topbar UI
 */
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
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Searching for:", searchTerm);
  };

  const handleSignOut = async () => {
    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            router.push("/");
            router.refresh();
          },
          onError: (ctx) => {
            console.error("Sign out failed:", ctx.error);
            alert("حدث خطأ أثناء تسجيل الخروج. يرجى المحاولة مرة أخرى.");
          },
        },
      });
    } catch (err) {
      console.error("Unexpected error during sign out:", err);
      alert("حدث خطأ أثناء تسجيل الخروج. يرجى المحاولة مرة أخرى.");
    }
  };

  const handleSettingsClick = () => {
    setIsProfileOpen(false);
    // TODO: Implement actual settings navigation or modal
    console.log("Navigating to settings...");
    // router.push("/settings"); 
  };

  const roleLabel = ROLE_LABELS[userRole] || userRole;

  return (
    <header className="topbar">
      {/* ── Right side: Logo, Title & Mobile Menu ── */}
      <div className="flex items-center gap-3">
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

        <div className="relative flex items-center gap-2 rtl:space-x-reverse">
          <button
            ref={bellRef}
            className="topbar-icon-btn relative"
            aria-label="عرض الإشعارات"
            onClick={() => setIsNotifOpen(!isNotifOpen)}
          >
            <Bell className="h-4 w-4" />
            {notifCount > 0 && (
              <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-(--color-danger) outline-2 outline-(--color-navy)"></span>
            )}
          </button>
          <NotificationDropdown
            isOpen={isNotifOpen}
            onClose={() => setIsNotifOpen(false)}
            anchorRef={bellRef}
          />
        </div>

        {/* Divider */}
        <div className="bg-border-2 hidden h-8 w-px sm:block"></div>

        {/* Profile */}
        <div className="topbar-profile-wrapper" ref={dropdownRef}>
          <button 
            className="flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-80 border-none bg-transparent p-0 text-inherit"
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            aria-haspopup="true"
            aria-expanded={isProfileOpen}
          >
            <div className="hidden flex-col items-end sm:flex text-right">
              <span className="text-xs font-semibold text-white">{userName}</span>
              <span className="topbar-subtitle">{roleLabel}</span>
            </div>
            <div className="topbar-profile-avatar">{userInitials}</div>
            <ChevronDown className={`h-3 w-3 text-light-text transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
          </button>

          {isProfileOpen && (
            <div className="topbar-dropdown">
              <div className="px-3 py-2 border-b border-white/5 mb-1 sm:hidden">
                <p className="text-xs font-bold text-white mb-0.5">{userName}</p>
                <p className="text-[10px] text-light-text">{roleLabel}</p>
              </div>
              <button 
                className="topbar-dropdown-item"
                onClick={handleSettingsClick}
              >
                <Settings className="h-4 w-4" />
                <span>إعدادات الحساب</span>
              </button>
              <button 
                className="topbar-dropdown-item danger"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>

  );
}
