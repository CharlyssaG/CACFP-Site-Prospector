"use client";

interface FilterBarProps {
  unsponsoredOnly: boolean;
  nonprofitOnly: boolean;
  forprofitOnly: boolean;
  areaEligibleOnly: boolean;
  licensedOnly: boolean;
  sortBy: string;
  onFilterChange: (key: string, value: boolean) => void;
  onSortChange: (sort: string) => void;
}

export function FilterBar({
  unsponsoredOnly,
  nonprofitOnly,
  forprofitOnly,
  areaEligibleOnly,
  licensedOnly,
  sortBy,
  onFilterChange,
  onSortChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 py-3 border-b" style={{ borderColor: "var(--color-border)" }}>
      <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: "var(--color-ink-faint)" }}>
        Filters
      </span>

      {[
        { key: "unsponsoredOnly", label: "Unsponsored", checked: unsponsoredOnly },
        { key: "nonprofitOnly", label: "Nonprofit", checked: nonprofitOnly },
        { key: "forprofitOnly", label: "For-profit", checked: forprofitOnly },
        { key: "areaEligibleOnly", label: "Area eligible", checked: areaEligibleOnly },
        { key: "licensedOnly", label: "Licensed", checked: licensedOnly },
      ].map(({ key, label, checked }) => (
        <label
          key={key}
          className="flex items-center gap-1.5 text-sm cursor-pointer select-none"
          style={{ color: "var(--color-ink-muted)" }}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onFilterChange(key, e.target.checked)}
            className="accent-[#1d8a50] w-3.5 h-3.5"
          />
          {label}
        </label>
      ))}

      <div className="sm:ml-auto">
        <select
          className="select-field text-xs py-1.5"
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
        >
          <option value="name">Sort: Name</option>
          <option value="capacity-desc">Capacity (high → low)</option>
          <option value="capacity-asc">Capacity (low → high)</option>
          <option value="eligibility">Eligibility score</option>
        </select>
      </div>
    </div>
  );
}
