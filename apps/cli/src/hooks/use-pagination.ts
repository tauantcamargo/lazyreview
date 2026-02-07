import { useState, useCallback, useMemo } from 'react';

export interface UsePaginationOptions<T> {
  items: T[];
  pageSize?: number;
  initialPage?: number;
}

export interface UsePaginationResult<T> {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  currentItems: T[];
  startIndex: number;
  endIndex: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  firstPage: () => void;
  lastPage: () => void;
  setPageSize: (size: number) => void;
}

export function usePagination<T>({
  items,
  pageSize: initialPageSize = 10,
  initialPage = 1,
}: UsePaginationOptions<T>): UsePaginationResult<T> {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Clamp current page to valid range
  const clampedPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (clampedPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const currentItems = useMemo(() => {
    return items.slice(startIndex, endIndex);
  }, [items, startIndex, endIndex]);

  const hasNextPage = clampedPage < totalPages;
  const hasPreviousPage = clampedPage > 1;

  const goToPage = useCallback(
    (page: number) => {
      const targetPage = Math.min(Math.max(1, page), totalPages);
      setCurrentPage(targetPage);
    },
    [totalPages]
  );

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setCurrentPage((p) => p + 1);
    }
  }, [hasNextPage]);

  const previousPage = useCallback(() => {
    if (hasPreviousPage) {
      setCurrentPage((p) => p - 1);
    }
  }, [hasPreviousPage]);

  const firstPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const lastPage = useCallback(() => {
    setCurrentPage(totalPages);
  }, [totalPages]);

  const setPageSize = useCallback(
    (size: number) => {
      const newSize = Math.max(1, size);
      setPageSizeState(newSize);

      // Adjust current page to keep showing similar items
      const firstVisibleIndex = startIndex;
      const newPage = Math.floor(firstVisibleIndex / newSize) + 1;
      setCurrentPage(Math.min(newPage, Math.ceil(totalItems / newSize)));
    },
    [startIndex, totalItems]
  );

  return {
    currentPage: clampedPage,
    totalPages,
    pageSize,
    totalItems,
    currentItems,
    startIndex,
    endIndex,
    hasNextPage,
    hasPreviousPage,
    goToPage,
    nextPage,
    previousPage,
    firstPage,
    lastPage,
    setPageSize,
  };
}

export interface UseInfiniteScrollOptions<T> {
  items: T[];
  initialLimit?: number;
  increment?: number;
}

export interface UseInfiniteScrollResult<T> {
  visibleItems: T[];
  visibleCount: number;
  totalItems: number;
  hasMore: boolean;
  loadMore: () => void;
  reset: () => void;
}

export function useInfiniteScroll<T>({
  items,
  initialLimit = 20,
  increment = 20,
}: UseInfiniteScrollOptions<T>): UseInfiniteScrollResult<T> {
  const [limit, setLimit] = useState(initialLimit);

  const visibleItems = useMemo(() => {
    return items.slice(0, limit);
  }, [items, limit]);

  const hasMore = limit < items.length;

  const loadMore = useCallback(() => {
    setLimit((l) => Math.min(l + increment, items.length));
  }, [increment, items.length]);

  const reset = useCallback(() => {
    setLimit(initialLimit);
  }, [initialLimit]);

  return {
    visibleItems,
    visibleCount: visibleItems.length,
    totalItems: items.length,
    hasMore,
    loadMore,
    reset,
  };
}

export interface UseVirtualScrollOptions {
  totalItems: number;
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

export interface UseVirtualScrollResult {
  startIndex: number;
  endIndex: number;
  visibleCount: number;
  totalHeight: number;
  offsetTop: number;
  scrollTo: (index: number) => void;
  scrollOffset: number;
  setScrollOffset: (offset: number) => void;
}

export function useVirtualScroll({
  totalItems,
  itemHeight,
  containerHeight,
  overscan = 3,
}: UseVirtualScrollOptions): UseVirtualScrollResult {
  const [scrollOffset, setScrollOffset] = useState(0);

  const totalHeight = totalItems * itemHeight;
  const visibleCount = Math.ceil(containerHeight / itemHeight);

  const startIndex = Math.max(0, Math.floor(scrollOffset / itemHeight) - overscan);
  const endIndex = Math.min(
    totalItems,
    Math.ceil((scrollOffset + containerHeight) / itemHeight) + overscan
  );

  const offsetTop = startIndex * itemHeight;

  const scrollTo = useCallback(
    (index: number) => {
      const targetOffset = index * itemHeight;
      setScrollOffset(Math.max(0, Math.min(targetOffset, totalHeight - containerHeight)));
    },
    [itemHeight, totalHeight, containerHeight]
  );

  return {
    startIndex,
    endIndex,
    visibleCount,
    totalHeight,
    offsetTop,
    scrollTo,
    scrollOffset,
    setScrollOffset,
  };
}
