import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSort } from './use-sort';

interface TestItem {
  id: number;
  name: string;
  date: string;
  score: number;
}

describe('useSort', () => {
  const items: TestItem[] = [
    { id: 3, name: 'Charlie', date: '2024-03-01', score: 85 },
    { id: 1, name: 'Alice', date: '2024-01-01', score: 95 },
    { id: 2, name: 'Bob', date: '2024-02-01', score: 90 },
  ];

  it('returns unsorted items when no sort config', () => {
    const { result } = renderHook(() => useSort({ items }));
    expect(result.current.sortedItems).toEqual(items);
    expect(result.current.sortConfig).toBeNull();
  });

  it('sorts by string field ascending', () => {
    const { result } = renderHook(() => useSort({ items }));

    act(() => {
      result.current.sortBy('name');
    });

    expect(result.current.sortedItems.map((i) => i.name)).toEqual([
      'Alice',
      'Bob',
      'Charlie',
    ]);
    expect(result.current.sortConfig?.field).toBe('name');
    expect(result.current.sortConfig?.direction).toBe('asc');
  });

  it('sorts by number field ascending', () => {
    const { result } = renderHook(() => useSort({ items }));

    act(() => {
      result.current.sortBy('id');
    });

    expect(result.current.sortedItems.map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it('toggles direction on same field', () => {
    const { result } = renderHook(() => useSort({ items }));

    act(() => {
      result.current.sortBy('name');
    });
    expect(result.current.sortConfig?.direction).toBe('asc');

    act(() => {
      result.current.sortBy('name');
    });
    expect(result.current.sortConfig?.direction).toBe('desc');
    expect(result.current.sortedItems.map((i) => i.name)).toEqual([
      'Charlie',
      'Bob',
      'Alice',
    ]);
  });

  it('resets to ascending on new field', () => {
    const { result } = renderHook(() => useSort({ items }));

    act(() => {
      result.current.sortBy('name');
      result.current.sortBy('name'); // Now desc
    });
    expect(result.current.sortConfig?.direction).toBe('desc');

    act(() => {
      result.current.sortBy('id');
    });
    expect(result.current.sortConfig?.direction).toBe('asc');
    expect(result.current.sortConfig?.field).toBe('id');
  });

  it('uses initial sort config', () => {
    const { result } = renderHook(() =>
      useSort({
        items,
        initialSort: { field: 'score', direction: 'desc' },
      })
    );

    expect(result.current.sortedItems.map((i) => i.score)).toEqual([95, 90, 85]);
    expect(result.current.sortConfig?.field).toBe('score');
    expect(result.current.sortConfig?.direction).toBe('desc');
  });

  it('toggles direction', () => {
    const { result } = renderHook(() =>
      useSort({
        items,
        initialSort: { field: 'name', direction: 'asc' },
      })
    );

    act(() => {
      result.current.toggleDirection();
    });

    expect(result.current.sortConfig?.direction).toBe('desc');
  });

  it('clears sort', () => {
    const { result } = renderHook(() =>
      useSort({
        items,
        initialSort: { field: 'name', direction: 'asc' },
      })
    );

    act(() => {
      result.current.clearSort();
    });

    expect(result.current.sortConfig).toBeNull();
    expect(result.current.sortedItems).toEqual(items);
  });

  it('checks if sorted by field', () => {
    const { result } = renderHook(() =>
      useSort({
        items,
        initialSort: { field: 'name', direction: 'asc' },
      })
    );

    expect(result.current.isSortedBy('name')).toBe(true);
    expect(result.current.isSortedBy('id')).toBe(false);
  });

  it('handles null values', () => {
    const itemsWithNull = [
      { id: 1, name: 'Alice' },
      { id: 2, name: null as unknown as string },
      { id: 3, name: 'Charlie' },
    ];

    const { result } = renderHook(() =>
      useSort({ items: itemsWithNull })
    );

    act(() => {
      result.current.sortBy('name');
    });

    expect(result.current.sortedItems[0].name).toBeNull();
  });

  it('sorts date strings correctly', () => {
    const { result } = renderHook(() => useSort({ items }));

    act(() => {
      result.current.sortBy('date');
    });

    expect(result.current.sortedItems.map((i) => i.date)).toEqual([
      '2024-01-01',
      '2024-02-01',
      '2024-03-01',
    ]);
  });
});
