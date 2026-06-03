"use client";

interface FilterBarProps {
  unsponsoredOnly: boolean;
  centerTypes: string[];
  areaEligibleOnly: boolean;
  licensedOnly: boolean;
  sortBy: string;
  onFilterChange: (key: string, value: boolean) => void;
  onCenterTypeChange: (type: string, checked: boolean) => void;
  onSortChange: (sort: string) => void;
}

const CENTER_TYPE_OPTIONS = [
  { value: "childcare-nonprofit",               label: "Childcare Nonprofit" },
  { value: "childcare-forprofit",               label: "Childcare For-profit" },
  { value: "head-start",                        label: "Head Start" },
  { value: "early-head-start",                  label: "Early Head Start" },
  { value: "migrant-seasonal-head-start",       label: "Migrant & Seasonal HS" },
  { value: "migrant-seasonal-early-head-start", label: "Migrant & Seasonal EHS" },
  { value: "aian-head-start",                   label: "AIAN Head Start" },
  { value: "aian-early-head-start",             label: "AIAN Early Head Start" },
  { value: "adult-care-program",                label: "Adult Care Program" },
  { value: "aras-sfsp",                         label: "ARAS / SFSP" },
];

export function FilterBar({
  unsponsoredOnly,
  centerTypes,
  areaEligibleOnly,
  licensedOnly,
  sortBy,
  onFilterChange,
  onCenterTypeChange,
  onSortChange,
}: FilterBarProps) {
  return (
    <div
      className="py-3 border-b"
      style={{ borderColor: "var(--color-subtle-border)" }}
    >
      {/* Row 1: standard filters + sort */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-3">
        <span
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: "var(--color-ink-faint)" }}
        >
          Filters
        </span>

        {[
          { key: "unsponsoredOnly",  label: "Unsponsored",  checked: unsponsoredOnly },
          { key: "areaEligibleOnly", label: "Area eligible", checked: areaEligibleOnly },
          { key: "licensedOnly",     label: "Licensed",      checked: licensedOnly },
        ].map(({ key, label, checked }) => (
          <label
            key={key}
            className="flex items-center gap-1.5 text-sm cursor-pointer select-none font-medium"
            style={{ color: checked ? "var(--color-blue)" : "var(--color-ink-muted)" }}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => onFilterChange(key, e.target.checked)}
              className="w-3.5 h-3.5 rounded"
              style={{ accentColor: "var(--color-blue)" }}
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

      {/* Row 2: center type multi-select */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: "var(--color-ink-faint)" }}
        >
          Type
        </span>
        {CENTER_TYPE_OPTIONS.map(({ value, label }) => {
          const checked = centerTypes.includes(value);
          return (
            <label
              key={value}
              className="flex items-center gap-1.5 text-xs cursor-pointer select-none font-medium"
              style={{ color: checked ? "var(--color-blue)" : "var(--color-ink-muted)" }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onCenterTypeChange(value, e.target.checked)}
                className="w-3 h-3 rounded"
                style={{ accentColor: "var(--color-blue)" }}
              />
              {label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
