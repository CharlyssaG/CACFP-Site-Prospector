"use client";

import { Search, MapPin } from "lucide-react";

interface SearchBarProps {
  query: string;
  searchType: string;
  onQueryChange: (q: string) => void;
  onTypeChange: (t: string) => void;
  onSearch: () => void;
  isLoading: boolean;
}

export function SearchBar({ query, searchType, onQueryChange, onTypeChange, onSearch, isLoading }: SearchBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <div className="relative flex-1">
        <MapPin
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2"
          style={{ color: "var(--color-blue)" }}
        />
        <input
          type="text"
          className="input-field pl-9"
          placeholder="Enter city, county, state, or ZIP code..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
        />
      </div>
      <select
        className="select-field w-full sm:w-36"
        value={searchType}
        onChange={(e) => onTypeChange(e.target.value)}
      >
        <option value="auto">Auto-detect</option>
        <option value="zip">ZIP code</option>
        <option value="city">City</option>
        <option value="county">County</option>
        <option value="state">State</option>
      </select>
      <button
        className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
        onClick={onSearch}
        disabled={isLoading || !query.trim()}
      >
        {isLoading ? (
          <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Search size={15} />
        )}
        Search
      </button>
    </div>
  );
}
