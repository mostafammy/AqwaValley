type Variant = "ok" | "warn" | "danger" | "info" | "gray" | "navy" | "gold";

const dotColors: Record<Variant, string> = {
  ok:     "var(--color-badge-ok-dot)",
  warn:   "var(--color-badge-warn-dot)",
  danger: "var(--color-badge-danger-dot)",
  info:   "var(--color-badge-info-dot)",
  gray:   "var(--color-badge-gray-dot)",
  navy:   "var(--color-badge-navy-dot)",
  gold:   "var(--color-badge-gold-dot)",
};

interface BadgeProps {
  variant?: Variant;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}

export function Badge({
  variant = "gray",
  children,
  dot = false,
  className = "",
  pulse = false,
}: BadgeProps & { pulse?: boolean }) {
  return (
    <span className={`badge badge-${variant} ${className}`}>
      {dot && (
        <span
          className="badge-dot relative"
          style={{ background: dotColors[variant] }}
        >
          {pulse && <span className="pulse-ring" style={{ color: dotColors[variant] }} />}
        </span>
      )}
      {children}
    </span>
  );
}