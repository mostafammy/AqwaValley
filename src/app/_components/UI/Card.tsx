type Accent = "blue" | "teal" | "danger" | "warn" | "sand" | "navy";
type PaddingSize = "md" | "sm";

interface CardProps {
  children: React.ReactNode;
  accent?: Accent;
  className?: string;
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

export function Card({ children, accent, className = "" }: CardProps) {
  return (
    <div className={`card ${accent ? `card-accent-${accent}` : ""} ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: CardHeaderProps) {
  return (
    <div className={`card-header ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <span className="card-title">
      {children}
    </span>
  );
}

export function CardBody({ children, size = "md", className = "" }: CardBodyProps) {
  return (
    <div className={`${size === "sm" ? "card-body-sm" : "card-body"} ${className}`}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = "" }: CardFooterProps) {
  return (
    <div className={`card-footer ${className}`}>
      {children}
    </div>
  );
}