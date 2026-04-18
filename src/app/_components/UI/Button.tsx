import { type ReactNode } from "react";
import { motion, AnimatePresence, type HTMLMotionProps } from "framer-motion";
import { tapFeedback } from "~/lib/motion";

type Variant =
  | "primary"
  | "ghost"
  | "danger"
  | "success"
  | "secondary"
  | "gold";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

const hoverByVariant: Record<Variant, { scale: number; y?: number }> = {
  primary: { scale: 1.02, y: -1 },
  success: { scale: 1.02, y: -1 },
  danger: { scale: 1.01 },
  secondary: { scale: 1.00 },
  ghost: { scale: 1.00 },
  gold: { scale: 1.03, y: -2 },
};

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
    <motion.button
      whileTap={tapFeedback}
      whileHover={disabled || loading ? undefined : hoverByVariant[variant]}
      disabled={disabled ?? loading}
      className={`btn btn-${variant} btn-${size} ${className}`}
      {...props}
    >
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.span
            key="loading"
            className="btn-shimmer-sweep"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        ) : icon ? (
          <motion.span
            key="icon"
            className="flex items-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            {icon}
          </motion.span>
        ) : null}
      </AnimatePresence>
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </motion.button>
  );
}
