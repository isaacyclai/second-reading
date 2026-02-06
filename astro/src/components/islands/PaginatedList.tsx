import { useState, useEffect, useCallback, useRef } from "preact/hooks";
import type { ListItem } from "../../lib/types";
import QuestionCard from "./QuestionCard";
import BillCard from "./BillCard";
import SessionCard from "./SessionCard";

interface DataResponse {
  items: ListItem[];
  total: number;
}

interface PagefindResult {
  id: string;
  data: () => Promise<{
    meta?: { id?: string };
    url: string;
    excerpt: string;
  }>;
}

interface PagefindSearch {
  results: PagefindResult[];
}

interface Pagefind {
  search: (
    query: string,
    options?: { filters?: Record<string, string> },
  ) => Promise<PagefindSearch>;
}

interface Props {
  contentType: "question" | "bill" | "motion" | "session";
  dataUrl: string;
  totalCount: number;
  pageSize?: number;
  placeholder?: string;
  initialItems: ListItem[];
}

// Filter items by date range using lexicographic comparison on YYYY-MM-DD strings
function filterByDateRange(
  items: ListItem[],
  from: string,
  to: string,
): ListItem[] {
  if (!from && !to) return items;
  return items.filter((item) => {
    if (!item.date) return false;
    if (from && item.date < from) return false;
    if (to && item.date > to) return false;
    return true;
  });
}

export default function PaginatedList({
  contentType,
  dataUrl,
  totalCount,
  pageSize = 20,
  placeholder = "Search...",
  initialItems,
}: Props) {
  const STAGGER_LIMIT = 12;
  const [items, setItems] = useState<ListItem[]>(initialItems);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ListItem[]>([]);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [allData, setAllData] = useState<ListItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filteredResults, setFilteredResults] = useState<ListItem[]>([]);

  const pagefindRef = useRef<Pagefind | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchSeqRef = useRef(0);

  const hasDateFilter = dateFrom !== "" || dateTo !== "";
  const isDateFilterMode = hasDateFilter && !isSearchMode;

  // Calculate pagination values
  const totalPages = Math.ceil(totalCount / pageSize);
  const searchTotalPages = Math.ceil(searchResults.length / pageSize);
  const filteredTotalPages = Math.ceil(filteredResults.length / pageSize);
  const currentTotalPages = isSearchMode
    ? searchTotalPages
    : isDateFilterMode
      ? filteredTotalPages
      : totalPages;
  const currentTotalCount = isSearchMode
    ? searchResults.length
    : isDateFilterMode
      ? filteredResults.length
      : totalCount;

  // Get current page items
  const currentItems = isSearchMode
    ? searchResults.slice((page - 1) * pageSize, page * pageSize)
    : isDateFilterMode
      ? filteredResults.slice((page - 1) * pageSize, page * pageSize)
      : items;

  // Status text
  const start = currentTotalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, currentTotalCount);
  const dateRangeLabel = hasDateFilter
    ? ` (${dateFrom || "start"}\u2009\u2013\u2009${dateTo || "present"})`
    : "";
  const statusText = isSearchMode
    ? currentTotalCount === 0
      ? "No results found"
      : `Found ${currentTotalCount} results (${start}-${end})${dateRangeLabel}`
    : isDateFilterMode
      ? currentTotalCount === 0
        ? `No items found${dateRangeLabel}`
        : `${currentTotalCount} items${dateRangeLabel} (${start}-${end})`
      : `Showing ${start}-${end} of ${currentTotalCount}`;

  // Load Pagefind
  const loadPagefind = useCallback(async (): Promise<Pagefind | null> => {
    if (pagefindRef.current) return pagefindRef.current;
    try {
      const base = (import.meta as any).env?.BASE_URL || "/";
      const pagefindPath = `${base}pagefind/pagefind.js`.replace(/\/+/g, "/");
      pagefindRef.current = (await import(
        /* @vite-ignore */ pagefindPath
      )) as Pagefind;
      return pagefindRef.current;
    } catch {
      console.warn("Pagefind not available - search will be disabled.");
      return null;
    }
  }, []);

  // Fetch all JSON data
  const fetchAllData = useCallback(async (): Promise<ListItem[]> => {
    if (allData) return allData;
    try {
      const response = await fetch(dataUrl);
      const data: DataResponse = await response.json();
      setAllData(data.items);
      return data.items;
    } catch (e) {
      console.error("Failed to fetch JSON data:", e);
      return [];
    }
  }, [dataUrl, allData]);

  // Update URL parameters
  const updateUrlParams = useCallback(
    (newPage: number, newQuery: string, from?: string, to?: string) => {
      const url = new URL(window.location.href);
      if (newQuery) {
        url.searchParams.set("q", newQuery);
      } else {
        url.searchParams.delete("q");
      }
      if (newPage > 1) {
        url.searchParams.set("page", String(newPage));
      } else {
        url.searchParams.delete("page");
      }
      // Use provided values, or fall back to current state
      const fromVal = from !== undefined ? from : dateFrom;
      const toVal = to !== undefined ? to : dateTo;
      if (fromVal) {
        url.searchParams.set("from", fromVal);
      } else {
        url.searchParams.delete("from");
      }
      if (toVal) {
        url.searchParams.set("to", toVal);
      } else {
        url.searchParams.delete("to");
      }
      window.history.replaceState({}, "", url.toString());
    },
    [dateFrom, dateTo],
  );

  // Apply date filter (no search query — browse + date filter mode)
  const applyDateFilter = useCallback(
    async (from: string, to: string) => {
      if (!from && !to) {
        // No date filter — return to browse mode
        setFilteredResults([]);
        setPage(1);
        setItems(initialItems);
        updateUrlParams(1, "", "", "");
        return;
      }

      setIsLoading(true);
      const data = await fetchAllData();
      const filtered = filterByDateRange(data, from, to);
      setFilteredResults(filtered);
      setPage(1);
      updateUrlParams(1, "", from, to);
      setIsLoading(false);
    },
    [fetchAllData, initialItems, updateUrlParams],
  );

  // Perform search
  const performSearch = useCallback(
    async (searchQuery: string, from?: string, to?: string) => {
      const searchSeq = (searchSeqRef.current += 1);
      const trimmedQuery = searchQuery.trim();
      const filterFrom = from !== undefined ? from : dateFrom;
      const filterTo = to !== undefined ? to : dateTo;

      if (!trimmedQuery || trimmedQuery.length <= 2) {
        setIsSearchMode(false);
        setSearchResults([]);
        setPage(1);
        setItems(initialItems);
        // If date filter active, apply it
        if (filterFrom || filterTo) {
          applyDateFilter(filterFrom, filterTo);
        } else {
          updateUrlParams(1, "", filterFrom, filterTo);
        }
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const pf = await loadPagefind();
      const data = await fetchAllData();
      if (searchSeq !== searchSeqRef.current) return;

      if (!pf) {
        // Fallback: simple text matching
        const lowerQuery = searchQuery.toLowerCase();
        let matched = data.filter((item) => {
          const text = [
            item.title,
            item.ministry,
            item.snippet,
            ...(item.speakers || []),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return text.includes(lowerQuery);
        });

        matched = filterByDateRange(matched, filterFrom, filterTo);

        setIsSearchMode(true);
        setSearchResults(matched);
        setPage(1);
        updateUrlParams(1, searchQuery, filterFrom, filterTo);
        if (searchSeq === searchSeqRef.current) {
          setIsLoading(false);
        }
        return;
      }

      // Use Pagefind for search
      const results = await pf.search(trimmedQuery, {
        filters: { type: contentType },
      });
      if (searchSeq !== searchSeqRef.current) return;

      // Get matching IDs in relevance order
      const matchedIds = new Set<string>();
      for (const result of results.results) {
        const resultData = await result.data();
        if (resultData.meta?.id) {
          matchedIds.add(resultData.meta.id);
        }
      }
      if (searchSeq !== searchSeqRef.current) return;

      // Build search results from full data in relevance order
      const dataById = new Map(data.map((item) => [item.id, item]));
      let matched: ListItem[] = [];
      for (const id of matchedIds) {
        const item = dataById.get(id);
        if (item) {
          matched.push(item);
        }
      }

      matched = filterByDateRange(matched, filterFrom, filterTo);

      setIsSearchMode(true);
      setSearchResults(matched);
      setPage(1);
      updateUrlParams(1, trimmedQuery, filterFrom, filterTo);
      if (searchSeq === searchSeqRef.current) {
        setIsLoading(false);
      }
    },
    [
      contentType,
      dateFrom,
      dateTo,
      fetchAllData,
      initialItems,
      loadPagefind,
      updateUrlParams,
      applyDateFilter,
    ],
  );

  // Load page data for browse mode
  const loadPage = useCallback(
    async (pageNum: number) => {
      if (pageNum === 1) {
        setItems(initialItems);
        return;
      }

      setIsLoading(true);
      const data = await fetchAllData();
      const start = (pageNum - 1) * pageSize;
      const pageItems = data.slice(start, start + pageSize);
      setItems(pageItems);
      setIsLoading(false);
    },
    [fetchAllData, initialItems, pageSize],
  );

  // Handle page change
  const handlePageChange = useCallback(
    async (newPage: number) => {
      if (newPage < 1 || newPage > currentTotalPages) return;
      setPage(newPage);
      if (isSearchMode || isDateFilterMode) {
        // Client-side pagination — no need to load page
        updateUrlParams(newPage, isSearchMode ? query : "");
      } else {
        await loadPage(newPage);
        updateUrlParams(newPage, "");
      }
    },
    [
      currentTotalPages,
      isSearchMode,
      isDateFilterMode,
      loadPage,
      query,
      updateUrlParams,
    ],
  );

  // Handle search input
  const handleSearchInput = useCallback(
    (e: Event) => {
      const value = (e.target as HTMLInputElement).value;
      setQuery(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        performSearch(value);
      }, 150);
    },
    [performSearch],
  );

  // Handle clear search text (preserve date filters)
  const handleClear = useCallback(() => {
    setQuery("");
    performSearch("");
    inputRef.current?.focus();
  }, [performSearch]);

  // Handle date changes
  const handleDateFromChange = useCallback(
    (e: Event) => {
      const value = (e.target as HTMLInputElement).value;
      setDateFrom(value);
      if (query.trim().length > 2) {
        performSearch(query, value, dateTo);
      } else {
        applyDateFilter(value, dateTo);
      }
    },
    [query, dateTo, performSearch, applyDateFilter],
  );

  const handleDateToChange = useCallback(
    (e: Event) => {
      const value = (e.target as HTMLInputElement).value;
      setDateTo(value);
      if (query.trim().length > 2) {
        performSearch(query, dateFrom, value);
      } else {
        applyDateFilter(dateFrom, value);
      }
    },
    [query, dateFrom, performSearch, applyDateFilter],
  );

  // Clear date filters
  const handleClearDates = useCallback(() => {
    setDateFrom("");
    setDateTo("");
    if (query.trim().length > 2) {
      performSearch(query, "", "");
    } else {
      setFilteredResults([]);
      setPage(1);
      setItems(initialItems);
      updateUrlParams(1, "", "", "");
    }
  }, [query, performSearch, initialItems, updateUrlParams]);

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && query) {
        setQuery("");
        performSearch("");
      }
    },
    [performSearch, query],
  );

  // Initialize from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const initialQuery = urlParams.get("q");
    const initialPage = urlParams.get("page");
    const initialFrom = urlParams.get("from") || "";
    const initialTo = urlParams.get("to") || "";

    if (initialFrom) setDateFrom(initialFrom);
    if (initialTo) setDateTo(initialTo);

    if (initialQuery) {
      setQuery(initialQuery);
      performSearch(initialQuery, initialFrom, initialTo);
    } else if (initialFrom || initialTo) {
      applyDateFilter(initialFrom, initialTo);
    } else if (initialPage) {
      const pageNum = parseInt(initialPage, 10);
      if (Number.isFinite(pageNum) && pageNum > 1) {
        setPage(pageNum);
        loadPage(pageNum);
      }
    }
  }, [loadPage, performSearch, applyDateFilter]);

  // Handle popstate for back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const queryParam = urlParams.get("q");
      const pageParam = urlParams.get("page");
      const fromParam = urlParams.get("from") || "";
      const toParam = urlParams.get("to") || "";

      setDateFrom(fromParam);
      setDateTo(toParam);

      if (queryParam) {
        setQuery(queryParam);
        performSearch(queryParam, fromParam, toParam);
      } else if (fromParam || toParam) {
        setQuery("");
        setIsSearchMode(false);
        setSearchResults([]);
        applyDateFilter(fromParam, toParam);
      } else {
        setQuery("");
        setIsSearchMode(false);
        setSearchResults([]);
        setFilteredResults([]);
        const pageNum = pageParam ? parseInt(pageParam, 10) : 1;
        const validPage =
          Number.isFinite(pageNum) && pageNum >= 1 ? pageNum : 1;
        setPage(validPage);
        loadPage(validPage);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [loadPage, performSearch, applyDateFilter]);

  // Preload pagefind on mount
  useEffect(() => {
    loadPagefind();
  }, [loadPagefind]);

  // Render card based on content type
  const renderCard = (item: ListItem) => {
    switch (contentType) {
      case "bill":
        return <BillCard item={item} />;
      case "session":
        return <SessionCard item={item} />;
      case "question":
      case "motion":
      default:
        return <QuestionCard item={item} />;
    }
  };

  return (
    <div class="paginated-list-wrapper">
      {/* Search input */}
      <div class="mb-4">
        <div class="relative">
          <svg
            class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/40 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            class="w-full rounded-lg border border-border bg-surface px-4 py-2.5 pl-10 pr-10 font-ui text-sm text-ink placeholder:text-ink/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors"
            placeholder={placeholder}
            autocomplete="off"
            spellcheck={false}
            value={query}
            onInput={handleSearchInput}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button
              type="button"
              class="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/40 hover:text-ink transition-colors"
              aria-label="Clear search"
              onClick={handleClear}
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Date range filters */}
      <div class="mb-6 flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2">
          <label
            class="text-xs font-ui uppercase tracking-wider text-ink-muted"
            for="date-from"
          >
            From
          </label>
          <input
            id="date-from"
            type="date"
            class="rounded-lg border border-border bg-surface px-3 py-1.5 font-ui text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors"
            value={dateFrom}
            onInput={handleDateFromChange}
          />
        </div>
        <div class="flex items-center gap-2">
          <label
            class="text-xs font-ui uppercase tracking-wider text-ink-muted"
            for="date-to"
          >
            To
          </label>
          <input
            id="date-to"
            type="date"
            class="rounded-lg border border-border bg-surface px-3 py-1.5 font-ui text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors"
            value={dateTo}
            onInput={handleDateToChange}
          />
        </div>
        {hasDateFilter && (
          <button
            type="button"
            class="border border-border bg-surface px-3 py-2 font-ui text-xs text-ink-muted hover:text-ink hover:border-accent/30 transition-colors"
            onClick={handleClearDates}
          >
            Clear dates
          </button>
        )}
      </div>

      {/* Status text */}
      <p class="font-sans text-sm text-ink-muted mb-6">{statusText}</p>

      {/* Loading indicator */}
      {isLoading && (
        <div class="flex items-center justify-center py-8">
          <div class="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
        </div>
      )}

      {/* Item list */}
      {!isLoading && (
        <div class="flex flex-col border-t border-border">
          {currentItems.length === 0 ? (
            <p class="py-12 text-center font-body text-ink-muted">
              {isSearchMode || isDateFilterMode
                ? "No results found"
                : "No items found"}
            </p>
          ) : (
            currentItems.map((item, i) => {
              const isStaggered =
                !isSearchMode &&
                !hasDateFilter &&
                page === 1 &&
                i < STAGGER_LIMIT;
              return (
                <div
                  key={item.id}
                  class={isStaggered ? "animate-fade-up" : undefined}
                  style={
                    isStaggered
                      ? `animation-delay: ${0.1 + i * 0.05}s`
                      : undefined
                  }
                >
                  {renderCard(item)}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Pagination controls */}
      {currentTotalPages > 1 && (
        <nav
          class="flex items-center justify-center gap-4 py-6"
          aria-label="Pagination"
        >
          <button
            class="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 font-ui text-sm text-ink/70 transition-all hover:border-accent/30 hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-ink/70"
            disabled={page === 1}
            onClick={() => handlePageChange(page - 1)}
          >
            <svg
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Previous
          </button>
          <span class="font-ui text-sm text-ink/50">
            Page <span class="font-medium text-ink">{page}</span> of{" "}
            <span class="font-medium text-ink">{currentTotalPages}</span>
          </span>
          <button
            class="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 font-ui text-sm text-ink/70 transition-all hover:border-accent/30 hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-ink/70"
            disabled={page >= currentTotalPages}
            onClick={() => handlePageChange(page + 1)}
          >
            Next
            <svg
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </nav>
      )}
    </div>
  );
}
