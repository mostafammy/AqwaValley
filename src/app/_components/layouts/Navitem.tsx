import Link from "next/link";
import { type ReactNode } from "react";

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
      className={`nav-item ${active ? "active" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      <span className="nav-item-icon">{icon}</span>
      <span className="nav-item-label">{label}</span>
      {badge}
    </Link>
  );
}

export function NavSectionTitle({ children }: { children: ReactNode }) {
  return <div className="nav-section-title">{children}</div>;
}

export function NavDivider() {
  return <div className="nav-divider" />;
}