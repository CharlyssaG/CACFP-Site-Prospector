"use client";

import { useState, useCallback, useRef } from "react";
import { SearchBar } from "@/components/SearchBar";
import { FilterBar } from "@/components/FilterBar";
import { StatsBar } from "@/components/StatsBar";
import { CenterCard } from "@/components/CenterCard";
import { Legend } from "@/components/Legend";
import { Pagination } from "@/components/Pagination";
import { exportToCSV } from "@/lib/data";
import type { Center, SearchStats } from "@/types";
import { Download, FileSearch, Globe } from "lucide-react";

const PAGE_SIZE = 50;

const SYSTEM_PROMPT = `You are a CACFP (Child and Adult Care Food Program) site prospecting assistant.
When given a location, find childcare centers, daycare facilities, Head Start programs,
adult care programs, and similar CACFP-eligible sites in that area using web search.

Return ONLY a valid JSON array of objects. No preamble, no markdown, no backticks.

Each object must have:
- name (string)
- address (string)
- city (string)
- state (2-letter string)
- zip (5-digit string)
- county (string or null)
- phone (string or null, format: (XXX) XXX-XXXX)
- email (string or null)
- director_name (string or null)
- center_type (one of: childcare-nonprofit, childcare-forprofit, head-start, early-head-start, migrant-seasonal-head-start, migrant-seasonal-early-head-start, aian-head-start, aian-early-head-start, adult-care-program, aras-sfsp)
- is_licensed (boolean)
- license_number (string or null)
- licensed_capacity (number or null)
- area_eligibility (one of: eligible, maybe, not-eligible, unknown)
- is_cacfp_participant (boolean)
- latitude (number or null)
- longitude (number or null)
- notes (string or null)

Return 10-25 real verifiable facilities only. Do not invent facilities.`;

export default function Home() {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState("auto");
  const [searchMode, setSearchMode] = useState<"database" | "web">("database");
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [allCenters, setAllCenters] = useState<Center[]>([]);
  const [stats, setStats] = useState<SearchStats | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastSearchMode, setLastSearchMode] = useState<"database" | "web">("database");
  const [webSavedCount, setWebSavedCount] = useState(0);

  const [unsponsoredOnly, setUnsponsoredOnly] = useState(false);
  const [centerTypes, setCenterTypes] = useState<string[]>([]);
  const [areaEligibleOnly, setAreaEligibleOnly] = useState(false);
  const [licensedOnly, setLicensedOnly] = useState(false);
  const [sortBy, setSortBy] = useState("name");

  const queryRef = useRef(query);
  queryRef.current = query;
  const modeRef = useRef(searchMode);
  modeRef.current = searchMode;

  const doWebSearch = useCallback(async (q: string) => {
    // Call Anthropic directly from the browser — no Vercel timeout
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "web-search-2025-03-05",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        tool_choice: { type: "auto" },
        messages: [
          {
            role: "user",
            content: `Find childcare centers, Head Start programs, adult care programs, and other CACFP-eligible facilities in: ${q}. Return only a JSON array.`,
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.json();
      throw new Error(err?.error?.message || "Anthropic API error");
    }

    const data = await anthropicRes.json();

    const textContent = (data.content || [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");

    const clean = textContent.replace(/```json|```/g, "").trim();
    const match = clean.match(/\[[\s\S]*\]/);
    if (!match) return [];

    try {
      return JSON.parse(match[0]);
    } catch {
      return [];
    }
  }, []);

  const doSearch = useCallback(
    async (overrides: {
      unsponsoredOnly?: boolean;
      centerTypes?: string[];
      areaEligibleOnly?: boolean;
      licensedOnly?: boolean;
      sortBy?: string;
    } = {}) => {
      const q = queryRef.current.trim();
      const mode = modeRef.current;
      if (!q) return;

      setIsLoading(true);
      setHasSearched(true);
      setCurrentPage(1);
      setLastSearchMode(mode);
      setWebSavedCount(0);

      try {
        if (mode === "web") {
          // 1. Fetch from Anthropic in browser (no timeout)
          const facilities = await doWebSearch(q);

          if (!facilities || facilities.length === 0) {
            setAllCenters([]);
            setStats(null);
            return;
          }

          // 2. Save to Supabase via fast endpoint (well under 10s)
          const saveRes = await fetch("/api/search/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ facilities }),
          });

          const saveData = await saveRes.json();
          setAllCenters(saveData.centers || []);
          setStats(saveData.stats || null);
          setWebSavedCount(saveData.saved_count || 0);

        } else {
          const effective = {
            unsponsoredOnly, centerTypes, areaEligibleOnly, licensedOnly, sortBy,
            ...overrides,
          };

          const params = new URLSearchParams({
            q,
            type: searchType,
            unsponsored: String(effective.unsponsoredOnly),
            centerTypes: effective.centerTypes.join(","),
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
        }
      } catch (err: any) {
        console.error("Search failed:", err);
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, searchType, searchMode, unsponsoredOnly, centerTypes, areaEligibleOnly, licensedOnly, sortBy, doWebSearch]
  );

  const handleModeChange = (m: "database" | "web") => {
    setSearchMode(m);
    setLastSearchMode(m);
    setAllCenters([]);
    setStats(null);
    setHasSearched(false);
  };

  const handleFilterChange = (key: string, value: boolean) => {
    if (key === "unsponsoredOnly")  setUnsponsoredOnly(value);
    if (key === "areaEligibleOnly") setAreaEligibleOnly(value);
    if (key === "licensedOnly")     setLicensedOnly(value);
    setTimeout(() => doSearch({ [key]: value }), 50);
  };

  const handleCenterTypeChange = (type: string, checked: boolean) => {
    const next = checked ? [...centerTypes, type] : centerTypes.filter((t) => t !== type);
    setCenterTypes(next);
    setTimeout(() => doSearch({ centerTypes: next }), 50);
  };

  const handleSortChange = (s: string) => {
    setSortBy(s);
    setTimeout(() => doSearch({ sortBy: s }), 50);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
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

  const pagedCenters = allCenters.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <main className="min-h-screen" style={{ background: "var(--color-light-gray)" }}>
      <header style={{ background: "var(--color-navy)" }}>
        <div className="max-w-5xl mx-auto px-7 py-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-bold tracking-tight" style={{ color: "var(--color-white)" }}>
                  <span style={{ color: "var(--color-white)" }}>Kid</span>
                  <span style={{ color: "var(--color-muted-blue)" }}>Kare</span>
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(225,241,249,0.12)", color: "var(--color-muted-blue)" }}>
                  CACFP Tools
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight" style={{ color: "var(--color-white)" }}>
                Site Prospector
              </h1>
              <p className="text-sm mt-2 max-w-xl font-normal leading-relaxed" style={{ color: "var(--color-muted-blue)" }}>
                Find childcare centers eligible for the USDA Child and Adult Care Food Program.
                Search your database or discover new sites from the web.
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0" style={{ background: "rgba(4,117,183,0.25)", color: "var(--color-muted-blue)" }}>
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "#4ade80" }} />
              Live
            </div>
          </div>
        </div>
      </header>

      <div style={{ background: "var(--color-light-blue)", borderBottom: "1px solid var(--color-subtle-border)" }}>
        <div className="max-w-5xl mx-auto px-7 py-5">
          <SearchBar
            query={query}
            searchType={searchType}
            searchMode={searchMode}
            onQueryChange={setQuery}
            onTypeChange={setSearchType}
            onModeChange={handleModeChange}
            onSearch={doSearch}
            isLoading={isLoading}
          />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-7 py-6">
        {hasSearched && (
          <div>
            {lastSearchMode === "web" && !isLoading && allCenters.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-4 text-sm" style={{ background: "rgba(4,117,183,0.08)", border: "1px solid var(--color-subtle-border)" }}>
                <Globe size={14} style={{ color: "var(--color-blue)" }} />
                <span style={{ color: "var(--color-navy)" }}>
                  <strong>{allCenters.length} facilities</strong> found via web search
                  {webSavedCount > 0 && (
                    <span style={{ color: "var(--color-ink-muted)" }}>
                      {" "}— {webSavedCount} new record{webSavedCount !== 1 ? "s" : ""} saved to database
                    </span>
                  )}
                </span>
              </div>
            )}

            {lastSearchMode === "database" && (
              <FilterBar
                unsponsoredOnly={unsponsoredOnly}
                centerTypes={centerTypes}
                areaEligibleOnly={areaEligibleOnly}
                licensedOnly={licensedOnly}
                sortBy={sortBy}
                onFilterChange={handleFilterChange}
                onCenterTypeChange={handleCenterTypeChange}
                onSortChange={handleSortChange}
              />
            )}

            {stats && !isLoading && (
              <div className="mt-5"><StatsBar stats={stats} /></div>
            )}

            {!isLoading && allCenters.length > 0 && (
              <div id="results-top" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 mt-5 scroll-mt-4">
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

            {isLoading && (
              <div className="flex items-center justify-center gap-3 py-16 text-sm font-medium" style={{ color: "var(--color-ink-faint)" }}>
                <span className="inline-block w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "var(--color-subtle-border)", borderTopColor: "var(--color-blue)" }} />
                {lastSearchMode === "web"
                  ? "Searching the web for CACFP-eligible facilities..."
                  : "Searching licensing databases & CACFP records..."}
              </div>
            )}

            {!isLoading && pagedCenters.length > 0 && (
              <div className="space-y-3">
                {pagedCenters.map((center, i) => (
                  <CenterCard key={center.id} center={center} index={i} />
                ))}
              </div>
            )}

            {!isLoading && allCenters.length > PAGE_SIZE && (
              <Pagination
                currentPage={currentPage}
                totalResults={allCenters.length}
                pageSize={PAGE_SIZE}
                onPageChange={handlePageChange}
                isLoading={isLoading}
              />
            )}

            {!isLoading && hasSearched && allCenters.length === 0 && (
              <div className="text-center py-16">
                <FileSearch size={32} className="mx-auto mb-3" style={{ color: "var(--color-ink-faint)" }} />
                <p className="text-sm" style={{ color: "var(--color-ink-muted)" }}>
                  {lastSearchMode === "web"
                    ? "No facilities found. Try a more specific city or county name."
                    : "No centers found. Try a different location or adjust your filters."}
                </p>
              </div>
            )}
          </div>
        )}

        {!hasSearched && (
          <>
            <div className="text-center py-14">
              <FileSearch size={36} className="mx-auto mb-4" style={{ color: "var(--color-ink-faint)" }} />
              <p className="text-sm max-w-md mx-auto leading-relaxed" style={{ color: "var(--color-ink-muted)" }}>
                Search your database of licensed childcare centers, or switch to Web Search
                to discover new facilities and automatically add them to your database.
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-4 mt-2">
              {[
                { title: "Nonprofit centers", desc: "Public or private nonprofit child care centers can participate directly — must be licensed or approved to provide day care services.", bg: "var(--color-white)", border: "var(--color-subtle-border)" },
                { title: "For-profit centers", desc: "Eligible if at least 25% of enrolled children receive Title XIX/XX benefits or qualify for free/reduced-price meals.", bg: "var(--color-light-blue)", border: "var(--color-subtle-border)" },
                { title: "Head Start programs", desc: "Automatically eligible — all enrolled children qualify for free meal reimbursement through CACFP.", bg: "var(--color-navy)", border: "var(--color-navy)" },
              ].map((item) => (
                <div key={item.title} className="rounded-xl p-5 text-sm" style={{ background: item.bg, border: `1px solid ${item.border}` }}>
                  <h3 className="font-bold mb-2 text-base" style={{ color: item.bg === "var(--color-navy)" ? "white" : "var(--color-navy)" }}>{item.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: item.bg === "var(--color-navy)" ? "var(--color-muted-blue)" : "var(--color-muted-text)" }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <footer className="mt-16 py-6" style={{ borderTop: "1px solid var(--color-subtle-border)", background: "var(--color-white)" }}>
        <div className="max-w-5xl mx-auto px-7">
          <p className="text-xs text-center" style={{ color: "var(--color-ink-faint)" }}>
            Data sourced from state licensing databases, USDA CACFP records, and web search.
            Verify all information with your state agency before outreach.
          </p>
        </div>
      </footer>
    </main>
  );
}
