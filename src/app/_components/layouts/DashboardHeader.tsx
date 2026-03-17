interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
}

export function DashboardHeader({ title, subtitle }: DashboardHeaderProps) {
  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
        {title}
      </h1>
      {subtitle && (
        <p style={{ color: "var(--color-muted)", fontSize: 13 }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
