import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearch } from './use-search';

interface TestItem {
  id: string;
  title: string;
  author: string;
}

describe('useSearch', () => {
  const items: TestItem[] = [
    { id: '1', title: 'Fix authentication bug', author: 'alice' },
    { id: '2', title: 'Add new feature', author: 'bob' },
    { id: '3', title: 'Update documentation', author: 'alice' },
    { id: '4', title: 'Refactor auth module', author: 'charlie' },
  ];

  it('returns all items when no query', () => {
    const { result } = renderHook(() =>
      useSearch({ items, searchFields: ['title'] })
    );
    expect(result.current.results).toHaveLength(4);
    expect(result.current.isSearching).toBe(false);
  });

  it('filters by single field', () => {
    const { result } = renderHook(() =>
      useSearch({ items, searchFields: ['title'] })
    );

    act(() => {
      result.current.setQuery('auth');
    });

    expect(result.current.results).toHaveLength(2);
    expect(result.current.results.map((r) => r.id)).toEqual(['1', '4']);
    expect(result.current.isSearching).toBe(true);
  });

  it('filters by multiple fields', () => {
    const { result } = renderHook(() =>
      useSearch({ items, searchFields: ['title', 'author'] })
    );

    act(() => {
      result.current.setQuery('alice');
    });

    expect(result.current.results).toHaveLength(2);
    expect(result.current.results.map((r) => r.id)).toEqual(['1', '3']);
  });

  it('is case insensitive by default', () => {
    const { result } = renderHook(() =>
      useSearch({ items, searchFields: ['title'] })
    );

    act(() => {
      result.current.setQuery('FIX');
    });

    expect(result.current.results).toHaveLength(1);
    expect(result.current.results[0].id).toBe('1');
  });

  it('supports case sensitive search', () => {
    const { result } = renderHook(() =>
      useSearch({ items, searchFields: ['title'], caseSensitive: true })
    );

    act(() => {
      result.current.setQuery('FIX');
    });

    expect(result.current.results).toHaveLength(0);

    act(() => {
      result.current.setQuery('Fix');
    });

    expect(result.current.results).toHaveLength(1);
  });

  it('clears search', () => {
    const { result } = renderHook(() =>
      useSearch({ items, searchFields: ['title'] })
    );

    act(() => {
      result.current.setQuery('auth');
    });
    expect(result.current.results).toHaveLength(2);

    act(() => {
      result.current.clearSearch();
    });
    expect(result.current.results).toHaveLength(4);
    expect(result.current.query).toBe('');
  });

  it('returns match count', () => {
    const { result } = renderHook(() =>
      useSearch({ items, searchFields: ['title'] })
    );

    act(() => {
      result.current.setQuery('auth');
    });

    expect(result.current.matchCount).toBe(2);
  });

  it('handles initial query', () => {
    const { result } = renderHook(() =>
      useSearch({ items, searchFields: ['title'], initialQuery: 'fix' })
    );

    expect(result.current.query).toBe('fix');
    expect(result.current.results).toHaveLength(1);
    expect(result.current.isSearching).toBe(true);
  });

  it('ignores whitespace-only query', () => {
    const { result } = renderHook(() =>
      useSearch({ items, searchFields: ['title'] })
    );

    act(() => {
      result.current.setQuery('   ');
    });

    expect(result.current.results).toHaveLength(4);
    expect(result.current.isSearching).toBe(false);
  });

  it('handles empty items array', () => {
    const { result } = renderHook(() =>
      useSearch({ items: [], searchFields: ['title'] as (keyof TestItem)[] })
    );

    act(() => {
      result.current.setQuery('test');
    });

    expect(result.current.results).toHaveLength(0);
    expect(result.current.matchCount).toBe(0);
  });

  it('handles null/undefined field values', () => {
    const itemsWithNull = [
      { id: '1', title: 'Test', author: null as unknown as string },
      { id: '2', title: undefined as unknown as string, author: 'bob' },
    ];

    const { result } = renderHook(() =>
      useSearch({ items: itemsWithNull, searchFields: ['title', 'author'] })
    );

    act(() => {
      result.current.setQuery('test');
    });

    expect(result.current.results).toHaveLength(1);
    expect(result.current.results[0].id).toBe('1');
  });
});
