"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalResults: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function Pagination({
  currentPage,
  totalResults,
  pageSize,
  onPageChange,
  isLoading = false,
}: PaginationProps) {
  const totalPages = Math.ceil(totalResults / pageSize);
  if (totalPages <= 1) return null;

  const startResult = (currentPage - 1) * pageSize + 1;
  const endResult = Math.min(currentPage * pageSize, totalResults);

  // Build page number array with ellipsis
  const getPageNumbers = (): (number | "...")[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | "...")[] = [1];
    if (currentPage > 3) pages.push("...");
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div
      className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 pt-5"
      style={{ borderTop: "1px solid var(--color-subtle-border)" }}
    >
      {/* Result range label */}
      <p className="text-xs" style={{ color: "var(--color-ink-muted)" }}>
        Showing{" "}
        <span className="font-semibold" style={{ color: "var(--color-navy)" }}>
          {startResult}–{endResult}
        </span>{" "}
        of{" "}
        <span className="font-semibold" style={{ color: "var(--color-navy)" }}>
          {totalResults.toLocaleString()}
        </span>{" "}
        centers
      </p>

      {/* Page controls */}
      <div className="flex items-center gap-1">
        {/* Prev */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1 || isLoading}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            borderColor: "var(--color-subtle-border)",
            color: "var(--color-blue)",
            background: "transparent",
          }}
          aria-label="Previous page"
        >
          <ChevronLeft size={13} />
          Prev
        </button>

        {/* Page numbers */}
        <div className="flex items-center gap-1 mx-1">
          {pages.map((page, i) =>
            page === "..." ? (
              <span
                key={`ellipsis-${i}`}
                className="px-1.5 text-xs"
                style={{ color: "var(--color-ink-faint)" }}
              >
                …
              </span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page as number)}
                disabled={isLoading}
                className="w-8 h-8 rounded-lg text-xs font-semibold transition-all duration-150 disabled:cursor-not-allowed"
                style={
                  page === currentPage
                    ? {
                        background: "var(--color-blue)",
                        color: "white",
                        border: "none",
                      }
                    : {
                        background: "transparent",
                        color: "var(--color-navy)",
                        border: "1px solid var(--color-subtle-border)",
                      }
                }
                aria-label={`Page ${page}`}
                aria-current={page === currentPage ? "page" : undefined}
              >
                {page}
              </button>
            )
          )}
        </div>

        {/* Next */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || isLoading}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            borderColor: "var(--color-subtle-border)",
            color: "var(--color-blue)",
            background: "transparent",
          }}
          aria-label="Next page"
        >
          Next
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}
