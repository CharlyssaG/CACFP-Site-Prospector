"use client";

import type { SearchStats } from "@/types";
import { Users, UserCheck, ShieldCheck, Building2 } from "lucide-react";

export function StatsBar({ stats }: { stats: SearchStats }) {
  const pctUnsponsored = stats.total_count
    ? Math.round((stats.unsponsored_count / stats.total_count) * 100) : 0;
  const pctEligible = stats.total_count
    ? Math.round((stats.eligible_count / stats.total_count) * 100) : 0;

  const items = [
    {
      icon: Building2,
      label: "Centers found",
      value: stats.total_count,
      sub: `${stats.nonprofit_count} nonprofit · ${stats.forprofit_count} for-profit`,
    },
    {
      icon: UserCheck,
      label: "Unsponsored",
      value: stats.unsponsored_count,
      sub: `${pctUnsponsored}% — recruitment targets`,
    },
    {
      icon: ShieldCheck,
      label: "Area eligible",
      value: stats.eligible_count,
      sub: `${pctEligible}% — 50%+ FRP area`,
    },
    {
      icon: Users,
      label: "Avg. capacity",
      value: stats.avg_capacity,
      sub: "licensed children",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      {items.map((item) => (
        <div key={item.label} className="metric-card">
          <div className="flex items-center gap-2 mb-2">
            <item.icon size={14} style={{ color: "var(--color-blue)" }} />
            <span className="text-xs font-medium" style={{ color: "var(--color-ink-muted)" }}>
              {item.label}
            </span>
          </div>
          <div className="text-2xl font-bold" style={{ color: "var(--color-navy)" }}>
            {item.value}
          </div>
          <div className="text-xs mt-0.5" style={{ color: "var(--color-ink-faint)" }}>
            {item.sub}
          </div>
        </div>
      ))}
    </div>
  );
}
