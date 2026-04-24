"use client";

const items = [
  { label: "Area eligible", color: "#97C459" },
  { label: "Possibly eligible", color: "#FAC775" },
  { label: "Unknown", color: "#B4B2A9" },
  { label: "Currently sponsored", color: "#AFA9EC" },
  { label: "Unsponsored", color: "#5DCAA5" },
];

export function Legend() {
  return (
    <div className="flex flex-wrap gap-4 mb-4 text-xs" style={{ color: "var(--color-ink-muted)" }}>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm"
            style={{ background: item.color }}
          />
          {item.label}
        </div>
      ))}
    </div>
  );
}
