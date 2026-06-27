"use client";

import type { MouseEventHandler, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { springs, tapFeedback, variants } from "~/lib/motion";

type SpringModalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: "md" | "lg";
  priority?: "default" | "danger";
};

export function SpringModal({
  isOpen,
  onClose,
  children,
  size = "md",
  priority = "default",
}: SpringModalProps) {
  const widthClass = size === "lg" ? "max-w-lg" : "max-w-md";
  const ringClass =
    priority === "danger" ? "ring-1 ring-red-100" : "ring-1 ring-black/5";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-110 flex items-end justify-center bg-black/40 p-0 backdrop-blur-md sm:items-center sm:p-4"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={springs.floaty}
        >
          <motion.div
            className={`relative flex max-h-[90dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:${widthClass} sm:rounded-panal ${ringClass}`}            variants={variants.modal}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

type SpringDropdownProps = {
  isOpen: boolean;
  children: ReactNode;
  className?: string;
};

export function SpringDropdown({
  isOpen,
  children,
  className = "",
}: SpringDropdownProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={`absolute left-0 top-full z-30 mt-2 min-w-38 rounded-xl border border-gray-200 bg-white p-1 shadow-xl ${className}`}
          variants={variants.dropdown}
          initial="hidden"
          animate="show"
          exit="exit"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function PendingInvitationBadge() {
  return (
    <span className="relative inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
      <span className="pulse-ring text-amber-400" />
      دعوة معلقة
    </span>
  );
}

type AnimatedUserRowProps = {
  delay?: number;
  children: ReactNode;
  className?: string;
};

export function AnimatedUserRow({
  delay = 0,
  children,
  className,
}: AnimatedUserRowProps) {
  return (
    <motion.tr
      className={className}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springs.floaty, delay }}
    >
      {children}
    </motion.tr>
  );
}

type SpringButtonProps = {
  children: ReactNode;
  className?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
};

export function SpringButton(props: SpringButtonProps) {
  const { className = "", children, ...rest } = props;
  return (
    <motion.button
      {...rest}
      whileTap={tapFeedback}
      transition={springs.snappy}
      className={className}
    >
      {children}
    </motion.button>
  );
}
