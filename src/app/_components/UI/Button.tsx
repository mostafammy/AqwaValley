import { type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger" | "success" | "secondary" | "gold";
type Size    = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled ?? loading}
      className={`btn btn-${variant} btn-${size} ${className}`}
      {...props}
    >
      {loading && (
        <span className="w-[13px] h-[13px] rounded-full border-2 border-white/30 border-t-white animate-spin" />
      )}
      {!loading && icon}
      {children}
    </button>
  );
}