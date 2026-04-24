"use client";

import { useState, useCallback } from "react";
import { SearchBar } from "@/components/SearchBar";
import { FilterBar } from "@/components/FilterBar";
import { StatsBar } from "@/components/StatsBar";
import { CenterCard } from "@/components/CenterCard";
import { Legend } from "@/components/Legend";
import { searchCenters, exportToCSV } from "@/lib/data";
import type { Center, SearchStats, SearchFilters } from "@/types";
import { Download, FileSearch } from "lucide-react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState("auto");
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [centers, setCenters] = useState<Center[]>([]);
  const [stats, setStats] = useState<SearchStats | null>(null);

  const [unsponsoredOnly, setUnsponsoredOnly] = useState(false);
  const [nonprofitOnly, setNonprofitOnly] = useState(false);
  const [forprofitOnly, setForprofitOnly] = useState(false);
  const [areaEligibleOnly, setAreaEligibleOnly] = useState(false);
  const [licensedOnly, setLicensedOnly] = useState(false);
  const [sortBy, setSortBy] = useState("name");

  const doSearch = useCallback(async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setHasSearched(true);
    try {
      const filters: SearchFilters = {
        query: query.trim(),
        searchType: searchType as SearchFilters["searchType"],
        unsponsoredOnly,
        centerType: nonprofitOnly ? "nonprofit" : forprofitOnly ? "for-profit" : null,
        areaEligibleOnly,
        licensedOnly,
        sortBy: sortBy as SearchFilters["sortBy"],
      };
      const result = await searchCenters(filters);
      setCenters(result.centers);
      setStats(result.stats);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [query, searchType, unsponsoredOnly, nonprofitOnly, forprofitOnly, areaEligibleOnly, licensedOnly, sortBy]);

  const handleFilterChange = (key: string, value: boolean) => {
    const setters: Record<string, (v: boolean) => void> = {
      unsponsoredOnly: setUnsponsoredOnly,
      nonprofitOnly: (v) => { setNonprofitOnly(v); if (v) setForprofitOnly(false); },
      forprofitOnly: (v) => { setForprofitOnly(v); if (v) setNonprofitOnly(false); },
      areaEligibleOnly: setAreaEligibleOnly,
      licensedOnly: setLicensedOnly,
    };
    setters[key]?.(value);
    setTimeout(() => doSearch(), 50);
  };

  const handleExport = () => {
    const csv = exportToCSV(centers);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cacfp-prospects-${query.trim().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen" style={{ background: "var(--color-light-gray)" }}>
      {/* Header — dark navy hero bar */}
      <header style={{ background: "var(--color-navy)" }}>
        <div className="max-w-5xl mx-auto px-7 py-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              {/* KidKare text-fallback logo: "Kid" navy-on-white / "Kare" blue */}
              <div className="flex items-center gap-3 mb-3">
                <span
                  className="text-sm font-bold tracking-tight"
                  style={{ color: "var(--color-white)" }}
                >
                  <span style={{ color: "var(--color-white)" }}>Kid</span>
                  <span style={{ color: "var(--color-muted-blue)" }}>Kare</span>
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: "rgba(225,241,249,0.12)", color: "var(--color-muted-blue)" }}
                >
                  CACFP Tools
                </span>
              </div>
              <h1
                className="text-2xl sm:text-3xl font-extrabold leading-tight"
                style={{ color: "var(--color-white)" }}
              >
                Site Prospector
              </h1>
              <p
                className="text-sm mt-2 max-w-xl font-normal leading-relaxed"
                style={{ color: "var(--color-muted-blue)" }}
              >
                Find childcare centers eligible for the USDA Child and Adult Care Food Program.
                Search by city, county, state, or ZIP to identify recruitment candidates.
              </p>
            </div>
            <div
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0"
              style={{ background: "rgba(4,117,183,0.25)", color: "var(--color-muted-blue)" }}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "#4ade80" }} />
              Live
            </div>
          </div>
        </div>
      </header>

      {/* Search bar — light blue band */}
      <div style={{ background: "var(--color-light-blue)", borderBottom: "1px solid var(--color-subtle-border)" }}>
        <div className="max-w-5xl mx-auto px-7 py-5">
          <SearchBar
            query={query}
            searchType={searchType}
            onQueryChange={setQuery}
            onTypeChange={setSearchType}
            onSearch={doSearch}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-7 py-6">
        {hasSearched && (
          <div>
            <FilterBar
              unsponsoredOnly={unsponsoredOnly}
              nonprofitOnly={nonprofitOnly}
              forprofitOnly={forprofitOnly}
              areaEligibleOnly={areaEligibleOnly}
              licensedOnly={licensedOnly}
              sortBy={sortBy}
              onFilterChange={handleFilterChange}
              onSortChange={(s) => { setSortBy(s); setTimeout(doSearch, 50); }}
            />

            {stats && !isLoading && (
              <div className="mt-5">
                <StatsBar stats={stats} />
              </div>
            )}

            {!isLoading && centers.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <Legend />
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: "var(--color-ink-faint)" }}>
                    {centers.length} center{centers.length !== 1 ? "s" : ""}
                  </span>
                  <button className="btn-outline flex items-center gap-1.5" onClick={handleExport}>
                    <Download size={12} />
                    Export CSV
                  </button>
                </div>
              </div>
            )}

            {isLoading && (
              <div
                className="flex items-center justify-center gap-3 py-16 text-sm font-medium"
                style={{ color: "var(--color-ink-faint)" }}
              >
                <span
                  className="inline-block w-5 h-5 border-2 rounded-full animate-spin"
                  style={{ borderColor: "var(--color-subtle-border)", borderTopColor: "var(--color-blue)" }}
                />
                Searching licensing databases &amp; CACFP records...
              </div>
            )}

            {!isLoading && centers.length > 0 && (
              <div className="space-y-3">
                {centers.map((center, i) => (
                  <CenterCard key={center.id} center={center} index={i} />
                ))}
              </div>
            )}

            {!isLoading && hasSearched && centers.length === 0 && (
              <div className="text-center py-16">
                <FileSearch size={32} className="mx-auto mb-3" style={{ color: "var(--color-ink-faint)" }} />
                <p className="text-sm" style={{ color: "var(--color-ink-muted)" }}>
                  No centers found matching your search and filters. Try a different location or adjust your filter criteria.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Initial empty state */}
        {!hasSearched && (
          <>
            <div className="text-center py-14">
              <FileSearch size={36} className="mx-auto mb-4" style={{ color: "var(--color-ink-faint)" }} />
              <p
                className="text-sm max-w-md mx-auto leading-relaxed"
                style={{ color: "var(--color-ink-muted)" }}
              >
                Search by city, county, state, or ZIP code to find childcare centers
                that may be eligible for the CACFP. Results include licensing status,
                current sponsor info, area eligibility, and contact details.
              </p>
            </div>

            {/* Eligibility reference cards */}
            <div className="grid sm:grid-cols-3 gap-4 mt-2">
              {[
                {
                  title: "Nonprofit centers",
                  desc: "Public or private nonprofit child care centers can participate directly — must be licensed or approved to provide day care services.",
                  bg: "var(--color-white)",
                  border: "var(--color-subtle-border)",
                },
                {
                  title: "For-profit centers",
                  desc: "Eligible if at least 25% of enrolled children receive Title XIX/XX benefits or qualify for free/reduced-price meals.",
                  bg: "var(--color-light-blue)",
                  border: "var(--color-subtle-border)",
                },
                {
                  title: "Head Start programs",
                  desc: "Automatically eligible — all enrolled children qualify for free meal reimbursement through CACFP.",
                  bg: "var(--color-navy)",
                  border: "var(--color-navy)",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl p-5 text-sm"
                  style={{ background: item.bg, border: `1px solid ${item.border}` }}
                >
                  <h3
                    className="font-bold mb-2 text-base"
                    style={{ color: item.bg === "var(--color-navy)" ? "white" : "var(--color-navy)" }}
                  >
                    {item.title}
                  </h3>
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: item.bg === "var(--color-navy)" ? "var(--color-muted-blue)" : "var(--color-muted-text)" }}
                  >
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer
        className="mt-16 py-6"
        style={{ borderTop: "1px solid var(--color-subtle-border)", background: "var(--color-white)" }}
      >
        <div className="max-w-5xl mx-auto px-7">
          <p className="text-xs text-center" style={{ color: "var(--color-ink-faint)" }}>
            Data sourced from state licensing databases and USDA CACFP records. Verify all information
            with your state agency before outreach. This tool is for prospecting purposes only and does
            not constitute official eligibility determination.
          </p>
        </div>
      </footer>
    </main>
  );
}
