"use client";

import { Search, Database, Globe, Loader2 } from "lucide-react";

interface SearchBarProps {
  query: string;
  searchType: string;
  searchMode: "database" | "web";
  onQueryChange: (q: string) => void;
  onTypeChange: (t: string) => void;
  onModeChange: (m: "database" | "web") => void;
  onSearch: () => void;
  isLoading: boolean;
}

export function SearchBar({
  query,
  searchType,
  searchMode,
  onQueryChange,
  onTypeChange,
  onModeChange,
  onSearch,
  isLoading,
}: SearchBarProps) {
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSearch();
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Mode toggle */}
      <div className="flex items-center gap-1 self-start">
        <button
          onClick={() => onModeChange("database")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
          style={
            searchMode === "database"
              ? { background: "var(--color-blue)", color: "white" }
              : { background: "transparent", color: "var(--color-ink-muted)", border: "1px solid var(--color-subtle-border)" }
          }
        >
          <Database size={11} />
          Database
        </button>
        <button
          onClick={() => onModeChange("web")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
          style={
            searchMode === "web"
              ? { background: "var(--color-blue)", color: "white" }
              : { background: "transparent", color: "var(--color-ink-muted)", border: "1px solid var(--color-subtle-border)" }
          }
        >
          <Globe size={11} />
          Web Search
        </button>
        {searchMode === "web" && (
          <span
            className="ml-2 text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: "rgba(4,117,183,0.12)", color: "var(--color-blue)" }}
          >
            Results auto-saved to database
          </span>
        )}
      </div>

      {/* Search input row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "var(--color-ink-faint)" }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleKey}
            placeholder={
              searchMode === "web"
                ? "Enter city, county, or state to search the web..."
                : "Enter city, county, state, or ZIP code..."
            }
            className="input-field pl-9 w-full"
          />
        </div>

        {searchMode === "database" && (
          <select
            className="select-field text-sm"
            value={searchType}
            onChange={(e) => onTypeChange(e.target.value)}
          >
            <option value="auto">Auto-detect</option>
            <option value="city">City</option>
            <option value="county">County</option>
            <option value="state">State</option>
            <option value="zip">ZIP</option>
          </select>
        )}

        <button
          onClick={onSearch}
          disabled={isLoading || !query.trim()}
          className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : searchMode === "web" ? (
            <Globe size={14} />
          ) : (
            <Search size={14} />
          )}
          {isLoading
            ? searchMode === "web" ? "Searching web..." : "Searching..."
            : "Search"}
        </button>
      </div>

      {searchMode === "web" && (
        <p className="text-xs" style={{ color: "var(--color-ink-faint)" }}>
          Web search uses AI to find facilities not yet in the database. Results are automatically saved and tagged as web-sourced.
        </p>
      )}
    </div>
  );
}
