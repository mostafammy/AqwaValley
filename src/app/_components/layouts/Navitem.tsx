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

export function NavItem({ href, icon, label, active = false, badge }: NavItemProps) {
  return (
    <Link 
      prefetch={true}
      href={href} 
      className={`group relative flex items-center gap-3 px-4 py-3 mx-2 my-1 overflow-hidden rounded-2xl transition-all duration-300 outline-none ${
        active 
          ? "text-sky-100 font-bold bg-white/10 shadow-lg ring-1 ring-white/20" 
          : "text-slate-400 hover:text-white hover:bg-white/5 font-medium"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {/* Background active glow */ }
      {active && (
        <motion.div
          layoutId="active-nav-bg"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.15),transparent_70%)] pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
      
      <span className={`relative z-10 transition-transform duration-300 ${active ? "scale-110 drop-shadow-md text-sky-400" : "group-hover:scale-110 group-hover:text-white"}`}>
        {icon}
      </span>
      <span className="relative z-10 text-[13px] tracking-wide">{label}</span>
      
      {badge && (
        <span className="relative z-10 mr-auto">
          {badge}
        </span>
      )}
    </Link>
  );
}

export function NavSectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="px-6 py-3 mt-4 mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500/80">
      {children}
    </div>
  );
}

export function NavDivider() {
  return <div className="mx-6 my-2 h-[1px] bg-white/5 rounded-full" />;
}