"use client";

import { useState, useCallback } from "react";
import { SearchBar } from "@/components/SearchBar";
import { FilterBar } from "@/components/FilterBar";
import { StatsBar } from "@/components/StatsBar";
import { CenterCard } from "@/components/CenterCard";
import { Legend } from "@/components/Legend";
import { searchCenters, exportToCSV } from "@/lib/data";
import type { Center, SearchStats, SearchFilters, CenterType } from "@/types";
import { Download, FileSearch } from "lucide-react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState("auto");
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [centers, setCenters] = useState<Center[]>([]);
  const [stats, setStats] = useState<SearchStats | null>(null);

  // Filters
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
        centerType: nonprofitOnly
          ? "nonprofit"
          : forprofitOnly
          ? "for-profit"
          : null,
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
    // Trigger re-search after filter change
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
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b" style={{ borderColor: "var(--color-border)", background: "white" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-start justify-between gap-4 mb-1">
            <div>
              <h1
                className="text-2xl sm:text-3xl font-bold leading-tight"
                style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}
              >
                CACFP site prospector
              </h1>
              <p className="text-sm mt-1 max-w-xl" style={{ color: "var(--color-ink-muted)" }}>
                Find childcare centers eligible for the USDA Child and Adult Care Food Program.
                Search by city, county, state, or ZIP to identify recruitment candidates.
              </p>
            </div>
            <div
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shrink-0"
              style={{ background: "var(--pill-eligible-bg)", color: "var(--pill-eligible-fg)" }}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-brand)" }} />
              Live
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Search */}
        <SearchBar
          query={query}
          searchType={searchType}
          onQueryChange={setQuery}
          onTypeChange={setSearchType}
          onSearch={doSearch}
          isLoading={isLoading}
        />

        {/* Results */}
        {hasSearched && (
          <div className="mt-6">
            {/* Filters */}
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

            {/* Stats */}
            {stats && !isLoading && (
              <div className="mt-5">
                <StatsBar stats={stats} />
              </div>
            )}

            {/* Legend + count */}
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

            {/* Loading state */}
            {isLoading && (
              <div className="flex items-center justify-center gap-3 py-16" style={{ color: "var(--color-ink-muted)" }}>
                <span className="inline-block w-5 h-5 border-2 border-[var(--color-border)] border-t-[var(--color-brand)] rounded-full animate-spin" />
                Searching licensing databases & CACFP records...
              </div>
            )}

            {/* Cards */}
            {!isLoading && centers.length > 0 && (
              <div className="space-y-3">
                {centers.map((center, i) => (
                  <CenterCard key={center.id} center={center} index={i} />
                ))}
              </div>
            )}

            {/* Empty state */}
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
          <div className="text-center py-20">
            <FileSearch size={36} className="mx-auto mb-4" style={{ color: "var(--color-ink-faint)" }} />
            <p className="text-sm max-w-md mx-auto leading-relaxed" style={{ color: "var(--color-ink-muted)" }}>
              Search by city, county, state, or ZIP code to find childcare centers
              that may be eligible for the CACFP. Results include licensing status,
              current sponsor info, area eligibility, and contact details.
            </p>
          </div>
        )}

        {/* CACFP eligibility reference */}
        {!hasSearched && (
          <div className="mt-10 grid sm:grid-cols-3 gap-4">
            {[
              {
                title: "Nonprofit centers",
                desc: "Public or private nonprofit child care centers can participate directly — must be licensed or approved to provide day care services.",
                color: "var(--pill-nonprofit-bg)",
              },
              {
                title: "For-profit centers",
                desc: "Eligible if at least 25% of enrolled children receive Title XIX/XX benefits or qualify for free/reduced-price meals.",
                color: "var(--pill-forprofit-bg)",
              },
              {
                title: "Head Start programs",
                desc: "Automatically eligible — all enrolled children qualify for free meal reimbursement through CACFP.",
                color: "var(--pill-headstart-bg)",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl p-4 text-sm"
                style={{ background: item.color }}
              >
                <h3 className="font-semibold mb-1" style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}>
                  {item.title}
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: "var(--color-ink-muted)" }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t mt-16 py-6" style={{ borderColor: "var(--color-border)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <p className="text-xs text-center" style={{ color: "var(--color-ink-faint)" }}>
            Data sourced from state licensing databases and USDA CACFP records. Verify all information with your state agency before outreach.
            This tool is for prospecting purposes only and does not constitute official eligibility determination.
          </p>
        </div>
      </footer>
    </main>
  );
}
