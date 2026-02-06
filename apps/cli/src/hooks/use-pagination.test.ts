import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  usePagination,
  useInfiniteScroll,
  useVirtualScroll,
} from './use-pagination';

describe('usePagination', () => {
  const items = Array.from({ length: 50 }, (_, i) => `item-${i}`);

  it('initializes with default values', () => {
    const { result } = renderHook(() => usePagination({ items }));

    expect(result.current.currentPage).toBe(1);
    expect(result.current.pageSize).toBe(10);
    expect(result.current.totalPages).toBe(5);
    expect(result.current.totalItems).toBe(50);
  });

  it('returns correct current items', () => {
    const { result } = renderHook(() => usePagination({ items, pageSize: 10 }));

    expect(result.current.currentItems).toHaveLength(10);
    expect(result.current.currentItems[0]).toBe('item-0');
    expect(result.current.currentItems[9]).toBe('item-9');
  });

  it('navigates to next page', () => {
    const { result } = renderHook(() => usePagination({ items, pageSize: 10 }));

    act(() => {
      result.current.nextPage();
    });

    expect(result.current.currentPage).toBe(2);
    expect(result.current.currentItems[0]).toBe('item-10');
  });

  it('navigates to previous page', () => {
    const { result } = renderHook(() =>
      usePagination({ items, pageSize: 10, initialPage: 3 })
    );

    act(() => {
      result.current.previousPage();
    });

    expect(result.current.currentPage).toBe(2);
  });

  it('goes to specific page', () => {
    const { result } = renderHook(() => usePagination({ items, pageSize: 10 }));

    act(() => {
      result.current.goToPage(4);
    });

    expect(result.current.currentPage).toBe(4);
    expect(result.current.currentItems[0]).toBe('item-30');
  });

  it('goes to first page', () => {
    const { result } = renderHook(() =>
      usePagination({ items, pageSize: 10, initialPage: 5 })
    );

    act(() => {
      result.current.firstPage();
    });

    expect(result.current.currentPage).toBe(1);
  });

  it('goes to last page', () => {
    const { result } = renderHook(() => usePagination({ items, pageSize: 10 }));

    act(() => {
      result.current.lastPage();
    });

    expect(result.current.currentPage).toBe(5);
  });

  it('clamps page to valid range', () => {
    const { result } = renderHook(() => usePagination({ items, pageSize: 10 }));

    act(() => {
      result.current.goToPage(100);
    });

    expect(result.current.currentPage).toBe(5);

    act(() => {
      result.current.goToPage(-5);
    });

    expect(result.current.currentPage).toBe(1);
  });

  it('reports hasNextPage correctly', () => {
    const { result } = renderHook(() => usePagination({ items, pageSize: 10 }));

    expect(result.current.hasNextPage).toBe(true);

    act(() => {
      result.current.lastPage();
    });

    expect(result.current.hasNextPage).toBe(false);
  });

  it('reports hasPreviousPage correctly', () => {
    const { result } = renderHook(() => usePagination({ items, pageSize: 10 }));

    expect(result.current.hasPreviousPage).toBe(false);

    act(() => {
      result.current.nextPage();
    });

    expect(result.current.hasPreviousPage).toBe(true);
  });

  it('does not go past last page', () => {
    const { result } = renderHook(() =>
      usePagination({ items, pageSize: 10, initialPage: 5 })
    );

    act(() => {
      result.current.nextPage();
    });

    expect(result.current.currentPage).toBe(5);
  });

  it('does not go before first page', () => {
    const { result } = renderHook(() => usePagination({ items, pageSize: 10 }));

    act(() => {
      result.current.previousPage();
    });

    expect(result.current.currentPage).toBe(1);
  });

  it('changes page size', () => {
    const { result } = renderHook(() => usePagination({ items, pageSize: 10 }));

    act(() => {
      result.current.setPageSize(25);
    });

    expect(result.current.pageSize).toBe(25);
    expect(result.current.totalPages).toBe(2);
    expect(result.current.currentItems).toHaveLength(25);
  });

  it('handles empty items', () => {
    const { result } = renderHook(() => usePagination({ items: [] }));

    expect(result.current.currentPage).toBe(1);
    expect(result.current.totalPages).toBe(1);
    expect(result.current.currentItems).toHaveLength(0);
  });

  it('provides correct indices', () => {
    const { result } = renderHook(() =>
      usePagination({ items, pageSize: 10, initialPage: 2 })
    );

    expect(result.current.startIndex).toBe(10);
    expect(result.current.endIndex).toBe(20);
  });
});

describe('useInfiniteScroll', () => {
  const items = Array.from({ length: 100 }, (_, i) => `item-${i}`);

  it('initializes with initial limit', () => {
    const { result } = renderHook(() =>
      useInfiniteScroll({ items, initialLimit: 20 })
    );

    expect(result.current.visibleItems).toHaveLength(20);
    expect(result.current.visibleCount).toBe(20);
    expect(result.current.totalItems).toBe(100);
    expect(result.current.hasMore).toBe(true);
  });

  it('loads more items', () => {
    const { result } = renderHook(() =>
      useInfiniteScroll({ items, initialLimit: 20, increment: 10 })
    );

    act(() => {
      result.current.loadMore();
    });

    expect(result.current.visibleItems).toHaveLength(30);
    expect(result.current.hasMore).toBe(true);
  });

  it('stops loading at total', () => {
    const { result } = renderHook(() =>
      useInfiniteScroll({ items, initialLimit: 90, increment: 20 })
    );

    act(() => {
      result.current.loadMore();
    });

    expect(result.current.visibleItems).toHaveLength(100);
    expect(result.current.hasMore).toBe(false);
  });

  it('resets to initial limit', () => {
    const { result } = renderHook(() =>
      useInfiniteScroll({ items, initialLimit: 20 })
    );

    act(() => {
      result.current.loadMore();
      result.current.loadMore();
    });

    expect(result.current.visibleCount).toBeGreaterThan(20);

    act(() => {
      result.current.reset();
    });

    expect(result.current.visibleCount).toBe(20);
  });

  it('handles items smaller than initial limit', () => {
    const smallItems = items.slice(0, 10);
    const { result } = renderHook(() =>
      useInfiniteScroll({ items: smallItems, initialLimit: 20 })
    );

    expect(result.current.visibleItems).toHaveLength(10);
    expect(result.current.hasMore).toBe(false);
  });
});

describe('useVirtualScroll', () => {
  it('calculates visible range', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalItems: 100,
        itemHeight: 20,
        containerHeight: 200,
      })
    );

    expect(result.current.startIndex).toBe(0);
    expect(result.current.endIndex).toBe(13); // 10 visible + 3 overscan
    expect(result.current.visibleCount).toBe(10);
  });

  it('updates range on scroll', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalItems: 100,
        itemHeight: 20,
        containerHeight: 200,
      })
    );

    act(() => {
      result.current.setScrollOffset(400); // Scroll down 20 items
    });

    expect(result.current.startIndex).toBe(17); // 20 - 3 overscan
    expect(result.current.endIndex).toBe(33); // 20 + 10 + 3 overscan
  });

  it('scrolls to specific index', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalItems: 100,
        itemHeight: 20,
        containerHeight: 200,
      })
    );

    act(() => {
      result.current.scrollTo(50);
    });

    expect(result.current.scrollOffset).toBe(1000); // 50 * 20
  });

  it('calculates total height', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalItems: 100,
        itemHeight: 20,
        containerHeight: 200,
      })
    );

    expect(result.current.totalHeight).toBe(2000); // 100 * 20
  });

  it('calculates offset for positioned items', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalItems: 100,
        itemHeight: 20,
        containerHeight: 200,
        overscan: 0,
      })
    );

    act(() => {
      result.current.setScrollOffset(200);
    });

    expect(result.current.offsetTop).toBe(200); // startIndex * itemHeight
  });

  it('clamps scroll to valid range', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalItems: 100,
        itemHeight: 20,
        containerHeight: 200,
      })
    );

    act(() => {
      result.current.scrollTo(1000); // Beyond total
    });

    // Should clamp to max scroll position
    expect(result.current.scrollOffset).toBe(1800); // totalHeight - containerHeight
  });

  it('handles custom overscan', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalItems: 100,
        itemHeight: 20,
        containerHeight: 200,
        overscan: 5,
      })
    );

    expect(result.current.startIndex).toBe(0);
    expect(result.current.endIndex).toBe(15); // 10 visible + 5 overscan
  });
});
