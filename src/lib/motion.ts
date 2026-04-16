import type { TargetAndTransition, Transition, Variants } from "framer-motion";

export const springs = {
  snappy: { type: "spring", stiffness: 400, damping: 28 } satisfies Transition,
  floaty: { type: "spring", stiffness: 200, damping: 22 } satisfies Transition,
  bouncy: { type: "spring", stiffness: 300, damping: 18 } satisfies Transition,
  silk: { type: "spring", stiffness: 170, damping: 24 } satisfies Transition,
} as const;

export const variants = {
  fadeSlideUp: {
    hidden: { opacity: 0, y: 18 },
    show: { opacity: 1, y: 0, transition: springs.floaty },
    exit: { opacity: 0, y: 8, transition: { duration: 0.18 } },
  } satisfies Variants,

  scaleIn: {
    hidden: { opacity: 0, scale: 0.96 },
    show: { opacity: 1, scale: 1, transition: springs.snappy },
    exit: { opacity: 0, scale: 0.98, transition: { duration: 0.16 } },
  } satisfies Variants,

  zoneCard: {
    hidden: { opacity: 0, y: 30, scale: 0.98 },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { ...springs.bouncy, delay: i * 0.08 },
    }),
    exit: { opacity: 0, y: 10, transition: { duration: 0.16 } },
  } satisfies Variants,

  modal: {
    hidden: { opacity: 0, scale: 0.95, y: 8 },
    show: { opacity: 1, scale: 1, y: 0, transition: springs.snappy },
    exit: { opacity: 0, scale: 0.98, y: 4, transition: { duration: 0.14 } },
  } satisfies Variants,

  dropdown: {
    hidden: { opacity: 0, scale: 0.97, y: -8 },
    show: { opacity: 1, scale: 1, y: 0, transition: springs.floaty },
    exit: { opacity: 0, scale: 0.98, y: -4, transition: { duration: 0.12 } },
  } satisfies Variants,

  staggerContainer: {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: 0.04 },
    },
  } satisfies Variants,

  staggerFast: {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.02 },
    },
  } satisfies Variants,
} as const;

export const tapFeedback: TargetAndTransition = {
  scale: 0.97,
  transition: springs.snappy,
};

export const tapFeedbackStrong: TargetAndTransition = {
  scale: 0.95,
  transition: springs.snappy,
};

export const cardLift = {
  whileHover: { y: -4, scale: 1.01, transition: springs.floaty },
  whileTap: tapFeedback,
};

/** Apple's signature ease-out — used for entrance animations */
export const APPLE_EASE = [0.16, 1, 0.3, 1] as const;

/** Spring for interactive elements (hover, tap, card lift) */
export const SPRING_INTERACTIVE = {
  type: "spring",
  stiffness: 400,
  damping: 30,
} as const;

/** Spring for chart bars growing from 0 */
export const SPRING_CHART = {
  type: "spring",
  stiffness: 100,
  damping: 15,
} as const;

/** Duration scale */
export const DURATION = {
  fast: 0.15,
  normal: 0.3,
  slow: 0.6,
  crawl: 1.5,
} as const;

export const STAGGER_DELAY = 0.05;

/** Entrance animation preset */
export const entranceFadeSlideUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: {
    delay,
    duration: DURATION.slow,
    ease: APPLE_EASE,
  },
});

/** Card hover interaction */
export const cardHover = {
  scale: 1.01,
  y: -2,
  transition: { duration: DURATION.fast, ease: "easeOut" },
};
