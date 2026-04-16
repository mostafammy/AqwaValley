import { motion } from "framer-motion";
import { cardLift } from "~/lib/motion";

type Accent = "blue" | "teal" | "danger" | "warn" | "sand" | "navy";
type PaddingSize = "md" | "sm";

interface CardProps {
  children: React.ReactNode;
  accent?: Accent;
  className?: string;
  onClick?: () => void;
  glass?: boolean | "xs" | "sm" | "md" | "lg" | "nav";
  lift?: boolean;
  glow?: "teal" | "blue" | "amber" | "none";
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface CardBodyProps {
  children: React.ReactNode;
  size?: PaddingSize;
  className?: string;
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({
  children,
  accent,
  className = "",
  onClick,
  glass,
  lift,
  glow,
}: CardProps) {
  let glassClass = "";
  if (glass === true) glassClass = "glass-md";
  else if (typeof glass === "string") glassClass = `glass-${glass}`;

  const glowClass = glow && glow !== "none" ? `glow-${glow}` : "";

  const classes = [
    glass ? glassClass : "card",
    accent ? `card-accent-${accent}` : "",
    glowClass,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (lift || onClick) {
    return (
      <motion.div
        className={classes}
        onClick={onClick}
        whileHover={lift ? cardLift.whileHover : undefined}
        whileTap={onClick ? cardLift.whileTap : undefined}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={classes} onClick={onClick}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: CardHeaderProps) {
  return <div className={`card-header ${className}`}>{children}</div>;
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <span className="card-title">{children}</span>;
}

export function CardBody({
  children,
  size = "md",
  className = "",
}: CardBodyProps) {
  return (
    <div
      className={`${size === "sm" ? "card-body-sm" : "card-body"} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardFooter({ children, className = "" }: CardFooterProps) {
  return <div className={`card-footer ${className}`}>{children}</div>;
}
