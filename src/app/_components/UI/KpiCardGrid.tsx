import { type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type KpiCardProps = {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  border?: string;
  iconBg?: string;
  iconColor?: string;
  extra?: ReactNode;
};

export function KpiCardGrid({ cards }: { cards: KpiCardProps[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {cards.map((card, i) => (
        <div
          key={i}
          className={`bg-white rounded-xl border border-gray-200 border-r-4 ${card.border ?? "border-r-blue-500"} p-5 shadow-sm`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500 font-medium">
              {card.label}
            </span>
            <div className={`p-2 rounded-lg ${card.iconBg ?? "bg-blue-50"}`}>
              <card.icon className={`h-4 w-4 ${card.iconColor ?? "text-blue-500"}`} />
            </div>
          </div>
          <div className="text-3xl font-bold">{card.value}</div>
          {card.extra && <div className="mt-2">{card.extra}</div>}
        </div>
      ))}
    </div>
  );
}
