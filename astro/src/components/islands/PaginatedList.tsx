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

  const pagefindRef = useRef<Pagefind | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchSeqRef = useRef(0);

  // Calculate pagination values
  const totalPages = Math.ceil(totalCount / pageSize);
  const searchTotalPages = Math.ceil(searchResults.length / pageSize);
  const currentTotalPages = isSearchMode ? searchTotalPages : totalPages;
  const currentTotalCount = isSearchMode ? searchResults.length : totalCount;

  // Get current page items
  const currentItems = isSearchMode
    ? searchResults.slice((page - 1) * pageSize, page * pageSize)
    : items;

  // Status text
  const start = currentTotalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, currentTotalCount);
  const statusText = isSearchMode
    ? currentTotalCount === 0
      ? "No results found"
      : `Found ${currentTotalCount} results (${start}-${end})`
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
  const updateUrlParams = useCallback((newPage: number, newQuery: string) => {
    const url = new URL(window.location.href);
    if (newQuery) {
      url.searchParams.set("q", newQuery);
      url.searchParams.delete("page");
    } else if (newPage > 1) {
      url.searchParams.set("page", String(newPage));
      url.searchParams.delete("q");
    } else {
      url.searchParams.delete("page");
      url.searchParams.delete("q");
    }
    window.history.replaceState({}, "", url.toString());
  }, []);

  // Perform search
  const performSearch = useCallback(
    async (searchQuery: string) => {
      const searchSeq = (searchSeqRef.current += 1);
      const trimmedQuery = searchQuery.trim();
      if (!trimmedQuery || trimmedQuery.length <= 2) {
        setIsSearchMode(false);
        setSearchResults([]);
        setPage(1);
        setItems(initialItems);
        updateUrlParams(1, "");
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
        const matched = data.filter((item) => {
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

        setIsSearchMode(true);
        setSearchResults(matched);
        setPage(1);
        updateUrlParams(1, searchQuery);
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
      const matched: ListItem[] = [];
      for (const id of matchedIds) {
        const item = dataById.get(id);
        if (item) {
          matched.push(item);
        }
      }

      setIsSearchMode(true);
      setSearchResults(matched);
      setPage(1);
      updateUrlParams(1, trimmedQuery);
      if (searchSeq === searchSeqRef.current) {
        setIsLoading(false);
      }
    },
    [contentType, fetchAllData, initialItems, loadPagefind, updateUrlParams],
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
      if (!isSearchMode) {
        await loadPage(newPage);
        updateUrlParams(newPage, "");
      } else {
        updateUrlParams(newPage, query);
      }
    },
    [currentTotalPages, isSearchMode, loadPage, query, updateUrlParams],
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

  // Handle clear
  const handleClear = useCallback(() => {
    setQuery("");
    performSearch("");
    inputRef.current?.focus();
  }, [performSearch]);

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

    if (initialQuery) {
      setQuery(initialQuery);
      performSearch(initialQuery);
    } else if (initialPage) {
      const pageNum = parseInt(initialPage, 10);
      if (Number.isFinite(pageNum) && pageNum > 1) {
        setPage(pageNum);
        loadPage(pageNum);
      }
    }
  }, [loadPage, performSearch]);

  // Handle popstate for back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const queryParam = urlParams.get("q");
      const pageParam = urlParams.get("page");

      if (queryParam) {
        setQuery(queryParam);
        performSearch(queryParam);
      } else {
        setQuery("");
        setIsSearchMode(false);
        setSearchResults([]);
        const pageNum = pageParam ? parseInt(pageParam, 10) : 1;
        const validPage =
          Number.isFinite(pageNum) && pageNum >= 1 ? pageNum : 1;
        setPage(validPage);
        loadPage(validPage);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [loadPage, performSearch]);

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
      <div class="mb-6">
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
              {isSearchMode ? "No results found" : "No items found"}
            </p>
          ) : (
            currentItems.map((item, i) => {
              const isStaggered =
                !isSearchMode && page === 1 && i < STAGGER_LIMIT;
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
