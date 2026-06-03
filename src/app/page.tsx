"use client";

import { useState, useCallback, useRef } from "react";
import { SearchBar } from "@/components/SearchBar";
import { FilterBar } from "@/components/FilterBar";
import { StatsBar } from "@/components/StatsBar";
import { CenterCard } from "@/components/CenterCard";
import { Legend } from "@/components/Legend";
import { Pagination } from "@/components/Pagination";
import { exportToCSV } from "@/lib/data";
import type { Center, SearchStats, SearchFilters } from "@/types";
import { Download, FileSearch } from "lucide-react";

const PAGE_SIZE = 50;

export default function Home() {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState("auto");
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // All results for export + stats
  const [allCenters, setAllCenters] = useState<Center[]>([]);
  const [stats, setStats] = useState<SearchStats | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [unsponsoredOnly, setUnsponsoredOnly] = useState(false);
  const [nonprofitOnly, setNonprofitOnly] = useState(false);
  const [forprofitOnly, setForprofitOnly] = useState(false);
  const [areaEligibleOnly, setAreaEligibleOnly] = useState(false);
  const [licensedOnly, setLicensedOnly] = useState(false);
  const [sortBy, setSortBy] = useState("name");

  // Ref so filter-triggered searches always use latest query
  const queryRef = useRef(query);
  queryRef.current = query;

  const doSearch = useCallback(
    async (overrides: Partial<{
      unsponsoredOnly: boolean;
      nonprofitOnly: boolean;
      forprofitOnly: boolean;
      areaEligibleOnly: boolean;
      licensedOnly: boolean;
      sortBy: string;
    }> = {}) => {
      const q = queryRef.current.trim();
      if (!q) return;

      setIsLoading(true);
      setHasSearched(true);
      setCurrentPage(1); // reset to page 1 on every new search

      const effective = {
        unsponsoredOnly,
        nonprofitOnly,
        forprofitOnly,
        areaEligibleOnly,
        licensedOnly,
        sortBy,
        ...overrides,
      };

      try {
        // Fetch ALL results (up to 2000) for accurate stats + export
        const params = new URLSearchParams({
          q,
          type: searchType,
          unsponsored: String(effective.unsponsoredOnly),
          centerType: effective.nonprofitOnly
            ? "nonprofit"
            : effective.forprofitOnly
            ? "for-profit"
            : "",
          eligible: String(effective.areaEligibleOnly),
          licensed: String(effective.licensedOnly),
          sort: effective.sortBy,
          limit: "2000",
          offset: "0",
        });

        const res = await fetch(`/api/search?${params}`);
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();

        setAllCenters(data.centers || []);
        setStats(data.stats || null);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, searchType, unsponsoredOnly, nonprofitOnly, forprofitOnly, areaEligibleOnly, licensedOnly, sortBy]
  );

  const handleFilterChange = (key: string, value: boolean) => {
    const updates: Record<string, boolean> = { [key]: value };
    if (key === "nonprofitOnly" && value) updates.forprofitOnly = false;
    if (key === "forprofitOnly" && value) updates.nonprofitOnly = false;

    // Apply local state
    if (key === "unsponsoredOnly") setUnsponsoredOnly(value);
    if (key === "nonprofitOnly") { setNonprofitOnly(value); if (value) setForprofitOnly(false); }
    if (key === "forprofitOnly") { setForprofitOnly(value); if (value) setNonprofitOnly(false); }
    if (key === "areaEligibleOnly") setAreaEligibleOnly(value);
    if (key === "licensedOnly") setLicensedOnly(value);

    setTimeout(() => doSearch(updates), 50);
  };

  const handleSortChange = (s: string) => {
    setSortBy(s);
    setTimeout(() => doSearch({ sortBy: s }), 50);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll back to results top
    document.getElementById("results-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleExport = () => {
    const csv = exportToCSV(allCenters);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cacfp-prospects-${query.trim().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Slice the current page from all results
  const pagedCenters = allCenters.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <main className="min-h-screen" style={{ background: "var(--color-light-gray)" }}>
      {/* Header */}
      <header style={{ background: "var(--color-navy)" }}>
        <div className="max-w-5xl mx-auto px-7 py-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-bold tracking-tight" style={{ color: "var(--color-white)" }}>
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
              <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight" style={{ color: "var(--color-white)" }}>
                Site Prospector
              </h1>
              <p className="text-sm mt-2 max-w-xl font-normal leading-relaxed" style={{ color: "var(--color-muted-blue)" }}>
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

      {/* Search bar */}
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
              onSortChange={handleSortChange}
            />

            {stats && !isLoading && (
              <div className="mt-5">
                <StatsBar stats={stats} />
              </div>
            )}

            {/* Results header — anchor for scroll-to */}
            {!isLoading && allCenters.length > 0 && (
              <div
                id="results-top"
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 mt-5 scroll-mt-4"
              >
                <Legend />
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: "var(--color-ink-faint)" }}>
                    {allCenters.length.toLocaleString()} center{allCenters.length !== 1 ? "s" : ""}
                  </span>
                  <button className="btn-outline flex items-center gap-1.5" onClick={handleExport}>
                    <Download size={12} />
                    Export all CSV
                  </button>
                </div>
              </div>
            )}

            {/* Loading */}
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

            {/* Results — current page only */}
            {!isLoading && pagedCenters.length > 0 && (
              <div className="space-y-3">
                {pagedCenters.map((center, i) => (
                  <CenterCard key={center.id} center={center} index={i} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {!isLoading && allCenters.length > PAGE_SIZE && (
              <Pagination
                currentPage={currentPage}
                totalResults={allCenters.length}
                pageSize={PAGE_SIZE}
                onPageChange={handlePageChange}
                isLoading={isLoading}
              />
            )}

            {/* Empty state */}
            {!isLoading && hasSearched && allCenters.length === 0 && (
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
              <p className="text-sm max-w-md mx-auto leading-relaxed" style={{ color: "var(--color-ink-muted)" }}>
                Search by city, county, state, or ZIP code to find childcare centers
                that may be eligible for the CACFP. Results include licensing status,
                current sponsor info, area eligibility, and contact details.
              </p>
            </div>

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
