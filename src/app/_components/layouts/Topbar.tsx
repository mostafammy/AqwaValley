"use client";
import { type UserRole } from "~/lib/types";
import {
  Bell,
  Droplets,
  LogOut,
  Menu,
  ChevronDown,
  Settings,
} from "lucide-react";
import { useSidebar } from "./SidebarProvider";
import { useState, useRef, useEffect } from "react";
import { authClient } from "~/server/better-auth/client";
import { useRouter } from "next/navigation";
import { NotificationDropdown } from "./NotificationDropdown";
import { api } from "~/trpc/react";
import { motion, AnimatePresence } from "framer-motion";

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
  weatherChip?: string; // للـ farm portal فقط
}

/**
 * Renders the portal's top navigation bar including branding, search, notifications, settings, and a user profile dropdown.
 *
 * @param userName - Display name shown in the profile area (default: "محمد أحمد")
 * @param userRole - User role key; controls role label and branding variant (e.g., GOV_ADMIN, SUPER_ADMIN, FARMER)
 * @param userInitials - Initials shown inside the avatar circle
 * @param portalLabel - Subtitle shown under the portal title
 * @param weatherChip - Optional small badge (e.g., current weather) rendered next to icons when provided
 * @returns The top-level JSX element for the portal topbar UI
 */
export function Topbar({
  userName = "محمد أحمد",
  userRole = "GOV_ADMIN",
  userInitials = "م.أ",
  portalLabel = "نظام إدارة الموارد المائية",
  weatherChip,
}: TopbarProps) {
  const { toggleMobile } = useSidebar();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement | null>(null);
  const router = useRouter();

  // Fetch unacknowledged alert count reactively via tRPC
  const { data: notifCount = 0 } = api.alerts.count.useQuery(undefined, {
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    router.push("/settings");
  };

  const roleLabel = ROLE_LABELS[userRole] ?? userRole;

  return (
    <header className="fixed top-0 right-0 left-0 z-1300 flex h-18 w-full items-center justify-between border-b border-black/5 bg-white/70 px-4 backdrop-blur-2xl transition-all duration-300 sm:px-6">
      {/* ── Right side: Logo, Title & Mobile Menu ── */}
      <div className="flex items-center gap-4">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={toggleMobile}
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-slate-100/50 text-slate-600 transition-colors hover:bg-slate-200/50 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </motion.button>

        <div className="from-navy to-navy-3 ring-navy/10 flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br shadow-md ring-1 lg:hidden">
          <Droplets className="h-5 w-5 text-sky-300" strokeWidth={2} />
        </div>
        <div className="hidden flex-col pr-2 lg:flex">
          <h1 className="text-lg font-extrabold tracking-tight text-slate-800">
            أكوا الوادي
          </h1>
          <p className="text-[11px] font-semibold text-slate-500">
            {portalLabel}
          </p>
        </div>
      </div>

      {/* ── Left side: Icons & Profile ── */}
      <div className="mr-auto flex items-center gap-2 sm:gap-4">
        {weatherChip && (
          <div className="hidden items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-4 py-1.5 text-[13px] font-bold text-sky-700 shadow-sm sm:flex">
            {weatherChip}
          </div>
        )}

        <div className="relative flex items-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            ref={bellRef}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-100/50 text-slate-600 transition-all hover:bg-slate-200"
            aria-label="عرض الإشعارات"
            onClick={() => setIsNotifOpen(!isNotifOpen)}
          >
            <Bell className="h-4.5 w-4.5" strokeWidth={2.5} />
            {notifCount > 0 && (
              <span className="absolute top-2 right-2 flex h-2.5 w-2.5 animate-pulse rounded-full bg-[#FF3B30] shadow-[0_0_0_2px_white] ring-1 ring-[#FF3B30]/50"></span>
            )}
          </motion.button>
          <NotificationDropdown
            isOpen={isNotifOpen}
            onClose={() => setIsNotifOpen(false)}
            anchorRef={bellRef}
          />
        </div>

        {/* Divider */}
        <div className="mx-1 hidden h-6 w-px bg-slate-200 sm:block"></div>

        {/* Profile */}
        <div className="relative" ref={dropdownRef}>
          <motion.button
            whileTap={{ scale: 0.98 }}
            className="group flex cursor-pointer items-center gap-3 rounded-full bg-transparent p-1 pr-1 pl-2 transition-colors outline-none hover:bg-slate-100"
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            aria-haspopup="true"
            aria-expanded={isProfileOpen}
          >
            <div className="hidden flex-col items-end text-right sm:flex">
              <span className="text-sm font-bold text-slate-800">
                {userName}
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                {roleLabel}
              </span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-tr from-sky-100 to-sky-50 text-sm font-bold text-sky-700 shadow-sm ring-1 ring-sky-200/50 transition-shadow group-hover:shadow-md">
              {userInitials}
            </div>
            <ChevronDown
              className={`h-4 w-4 text-slate-400 transition-transform duration-300 ${isProfileOpen ? "rotate-180" : ""}`}
            />
          </motion.button>

          <AnimatePresence>
            {isProfileOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="absolute top-full left-0 mt-2 w-56 origin-top-left overflow-hidden rounded-2xl bg-white/90 p-1.5 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl"
              >
                <div className="mb-1 border-b border-slate-100 px-3 py-3 sm:hidden">
                  <p className="text-sm font-bold text-slate-800">{userName}</p>
                  <p className="text-xs font-medium text-slate-500">
                    {roleLabel}
                  </p>
                </div>
                <div className="flex flex-col gap-0.5">
                  {userRole !== "FARMER" && (
                    <button
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors outline-none hover:bg-slate-100"
                      onClick={handleSettingsClick}
                    >
                      <Settings className="h-4.5 w-4.5 text-slate-400" />
                      <span>إعدادات الحساب</span>
                    </button>
                  )}
                  <button
                    className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 transition-colors outline-none hover:bg-red-50"
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-4.5 w-4.5 text-red-400 group-hover:text-red-500" />
                    <span>تسجيل الخروج</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
