"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { motion } from "framer-motion";

interface NavItemProps {
  href: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
  badge?: ReactNode;
}

export function NavItem({
  href,
  icon,
  label,
  active = false,
  badge,
}: NavItemProps) {
  return (
    <Link
      prefetch={true}
      href={href}
      className={`group relative mx-2 my-1 flex items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 transition-all duration-300 outline-none ${
        active
          ? "font-bold text-sky-400"
          : "font-medium text-slate-400 hover:bg-white/5 hover:text-white"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {active && (
        <motion.div
          layoutId="active-nav-bg"
          className="pointer-events-none absolute right-0 top-1/2 -mt-[14px] h-[28px] w-1 rounded-l-full bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.5)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}

      <span
        className={`relative z-10 transition-transform duration-300 ${active ? "scale-110 text-sky-400 drop-shadow-md" : "group-hover:scale-110 group-hover:text-white"}`}
      >
        {icon}
      </span>
      <span className="relative z-10 text-[13px] tracking-wide">{label}</span>

      {badge && <span className="relative z-10 mr-auto">{badge}</span>}
    </Link>
  );
}

export function NavSectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 mb-1 px-6 py-3 text-[11px] font-bold tracking-wider text-slate-500/80 uppercase">
      {children}
    </div>
  );
}

export function NavDivider() {
  return <div className="mx-6 my-2 h-[1px] rounded-full bg-white/5" />;
}
