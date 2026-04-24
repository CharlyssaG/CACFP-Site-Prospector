"use client";

import type { Center } from "@/types";
import { Phone, Mail, MapPin, User, ShieldCheck, AlertTriangle } from "lucide-react";

function Pill({
  label,
  bg,
  fg,
}: {
  label: string;
  bg: string;
  fg: string;
}) {
  return (
    <span className="pill" style={{ background: bg, color: fg }}>
      {label}
    </span>
  );
}

export function CenterCard({
  center,
  index,
}: {
  center: Center;
  index: number;
}) {
  const typePills: Record<string, { label: string; bg: string; fg: string }> = {
    "head-start": { label: "Head Start", bg: "var(--pill-headstart-bg)", fg: "var(--pill-headstart-fg)" },
    nonprofit: { label: "Nonprofit", bg: "var(--pill-nonprofit-bg)", fg: "var(--pill-nonprofit-fg)" },
    "for-profit": { label: "For-profit", bg: "var(--pill-forprofit-bg)", fg: "var(--pill-forprofit-fg)" },
  };

  const eligPills: Record<string, { label: string; bg: string; fg: string }> = {
    eligible: { label: "Area eligible", bg: "var(--pill-eligible-bg)", fg: "var(--pill-eligible-fg)" },
    maybe: { label: "Possibly eligible", bg: "var(--pill-maybe-bg)", fg: "var(--pill-maybe-fg)" },
    unknown: { label: "Eligibility unknown", bg: "var(--pill-unknown-bg)", fg: "var(--pill-unknown-fg)" },
    "not-eligible": { label: "Not area eligible", bg: "var(--pill-unknown-bg)", fg: "var(--pill-unknown-fg)" },
  };

  const tp = typePills[center.center_type] || typePills.nonprofit;
  const ep = eligPills[center.area_eligibility] || eligPills.unknown;

  const meetsForProfitThreshold =
    center.center_type === "for-profit" && (center.subsidy_pct || 0) >= 25;

  return (
    <div
      className="center-card p-5 animate-card"
      style={{ animationDelay: `${Math.min(index * 40, 600)}ms` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3
            className="text-base font-semibold leading-snug"
            style={{ fontFamily: "'DM Serif Display', Georgia, serif", color: "var(--color-ink)" }}
          >
            {center.name}
          </h3>
          <p className="flex items-center gap-1 text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
            <MapPin size={12} />
            {center.address}, {center.city}, {center.state} {center.zip}
          </p>
        </div>
      </div>

      {/* Pills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <Pill {...tp} />
        <Pill {...ep} />
        {center.sponsor_id ? (
          <Pill label="Sponsored" bg="var(--pill-sponsored-bg)" fg="var(--pill-sponsored-fg)" />
        ) : (
          <Pill label="Unsponsored" bg="var(--pill-unsponsored-bg)" fg="var(--pill-unsponsored-fg)" />
        )}
        {center.is_licensed ? (
          <Pill label="Licensed" bg="var(--color-surface-alt)" fg="var(--color-ink-muted)" />
        ) : (
          <Pill label="Unlicensed" bg="#fcebeb" fg="#791f1f" />
        )}
      </div>

      {/* Details grid */}
      <div
        className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm py-3 border-t"
        style={{ borderColor: "var(--color-border)" }}
      >
        {center.director_name && (
          <>
            <span className="flex items-center gap-1.5" style={{ color: "var(--color-ink-muted)" }}>
              <User size={12} /> Director
            </span>
            <span className="text-right font-medium">{center.director_name}</span>
          </>
        )}
        {center.phone && (
          <>
            <span className="flex items-center gap-1.5" style={{ color: "var(--color-ink-muted)" }}>
              <Phone size={12} /> Phone
            </span>
            <span className="text-right">
              <a href={`tel:${center.phone}`} className="hover:underline" style={{ color: "var(--color-brand)" }}>
                {center.phone}
              </a>
            </span>
          </>
        )}
        {center.email && (
          <>
            <span className="flex items-center gap-1.5" style={{ color: "var(--color-ink-muted)" }}>
              <Mail size={12} /> Email
            </span>
            <span className="text-right truncate">
              <a href={`mailto:${center.email}`} className="hover:underline" style={{ color: "var(--color-brand)" }}>
                {center.email}
              </a>
            </span>
          </>
        )}
        <span style={{ color: "var(--color-ink-muted)" }}>Licensed capacity</span>
        <span className="text-right font-medium">{center.licensed_capacity ?? "—"} children</span>

        <span style={{ color: "var(--color-ink-muted)" }}>Current enrollment</span>
        <span className="text-right">{center.current_enrollment ?? "—"} children</span>

        <span style={{ color: "var(--color-ink-muted)" }}>Area FRP rate</span>
        <span className="text-right font-medium">{center.frp_percentage ?? "—"}%</span>

        {center.license_number && (
          <>
            <span style={{ color: "var(--color-ink-muted)" }}>License #</span>
            <span className="text-right font-mono text-xs">{center.license_number}</span>
          </>
        )}

        <span style={{ color: "var(--color-ink-muted)" }}>Subsidy recipients</span>
        <span className="text-right">{center.subsidy_pct ?? "—"}%</span>
      </div>

      {/* Sponsor block */}
      {center.sponsor && (
        <div className="sponsor-block">
          <div className="text-[10px] font-semibold tracking-widest uppercase mb-1" style={{ color: "var(--color-ink-faint)" }}>
            Current CACFP sponsor
          </div>
          <div className="font-semibold text-sm">{center.sponsor.name}</div>
          {center.sponsor.phone && (
            <div className="text-xs mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
              {center.sponsor.phone}
            </div>
          )}
        </div>
      )}

      {/* For-profit eligibility note */}
      {center.center_type === "for-profit" && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 mt-3 text-xs"
          style={{
            background: meetsForProfitThreshold ? "var(--pill-eligible-bg)" : "var(--pill-maybe-bg)",
            color: meetsForProfitThreshold ? "var(--pill-eligible-fg)" : "var(--pill-maybe-fg)",
          }}
        >
          {meetsForProfitThreshold ? (
            <ShieldCheck size={14} className="mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          )}
          <span>
            {center.subsidy_pct}% of enrollees receive subsidies
            {meetsForProfitThreshold
              ? " — meets 25% threshold for for-profit eligibility"
              : " — below 25% threshold, may not qualify"}
          </span>
        </div>
      )}
    </div>
  );
}
