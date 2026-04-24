"use client";

const items = [
  { label: "Area eligible",      bg: "var(--color-blue)",       fg: "white" },
  { label: "Possibly eligible",  bg: "var(--color-light-blue)", fg: "var(--color-navy)" },
  { label: "Unknown",            bg: "var(--color-light-gray)", fg: "var(--color-muted-text)" },
  { label: "Sponsored",          bg: "var(--color-navy)",       fg: "white" },
  { label: "Unsponsored",        bg: "var(--color-blue)",       fg: "white" },
];

export function Legend() {
  return (
    <div className="flex flex-wrap gap-3 mb-4 text-xs" style={{ color: "var(--color-ink-muted)" }}>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: item.bg }}
          />
          {item.label}
        </div>
      ))}
    </div>
  );
}
