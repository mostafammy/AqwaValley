import Link from "next/link";
import { Badge } from "~/app/_components/UI/Badge";
import { wellStatusLabel, wellStatusVariant } from "~/lib/utils";

type WellStatusCardProps = {
  id:         string;
  name:       string;
  status:     "active" | "inactive" | "maintenance" | "offline" | "restricted";
  levelPct:   number;
  flowRate:   number | null;
  alertCount: number;
};

export function WellStatusCard({
  id,
  name,
  status,
  levelPct,
  flowRate,
  alertCount,
}: WellStatusCardProps) {
  const variant = wellStatusVariant(status);
  const label = wellStatusLabel(status);

  // Map variant to bar color variable
  const barColor = `var(--color-badge-${variant}-dot)`;
  const bgColor = `var(--color-badge-${variant}-bg)`;

  return (
    <Link href={`/wells/${id}`}>
      <div 
        className="rounded-xl border border-gray-200 p-4 shadow-sm cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
        style={{ backgroundColor: bgColor }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-gray-700 truncate">{name}</span>
          {alertCount > 0 && (
            <Badge variant="danger" className="px-1.5 py-0 min-w-5 justify-center h-5">
              {alertCount}
            </Badge>
          )}
        </div>

        {/* Level Bar */}
        <div className="mb-2">
          <div className="flex justify-between text-[10px] text-gray-500 mb-1">
            <span>المنسوب</span>
            <span className="font-bold">{levelPct}%</span>
          </div>
          <div className="h-1.5 bg-gray-200/50 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${levelPct}%`, backgroundColor: barColor }}
            />
          </div>
        </div>

        {/* Flow Rate */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-400">
            {flowRate != null ? `${flowRate} م³/ساعة` : "—"}
          </span>
          <Badge variant={variant} className="text-[9px]">
            {label}
          </Badge>
        </div>
      </div>
    </Link>
  );
}
