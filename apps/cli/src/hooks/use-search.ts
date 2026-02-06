import { useState, useMemo, useCallback } from 'react';

export interface UseSearchOptions<T> {
  items: T[];
  searchFields: (keyof T)[];
  initialQuery?: string;
  caseSensitive?: boolean;
}

export interface UseSearchResult<T> {
  query: string;
  setQuery: (query: string) => void;
  results: T[];
  isSearching: boolean;
  clearSearch: () => void;
  matchCount: number;
}

export function useSearch<T>({
  items,
  searchFields,
  initialQuery = '',
  caseSensitive = false,
}: UseSearchOptions<T>): UseSearchResult<T> {
  const [query, setQuery] = useState(initialQuery);

  const normalizedQuery = useMemo(
    () => (caseSensitive ? query : query.toLowerCase()),
    [query, caseSensitive]
  );

  const results = useMemo(() => {
    if (!normalizedQuery.trim()) {
      return items;
    }

    return items.filter((item) => {
      return searchFields.some((field) => {
        const value = item[field];
        if (value === null || value === undefined) {
          return false;
        }
        const stringValue = String(value);
        const normalizedValue = caseSensitive
          ? stringValue
          : stringValue.toLowerCase();
        return normalizedValue.includes(normalizedQuery);
      });
    });
  }, [items, searchFields, normalizedQuery, caseSensitive]);

  const clearSearch = useCallback(() => {
    setQuery('');
  }, []);

  return {
    query,
    setQuery,
    results,
    isSearching: normalizedQuery.trim().length > 0,
    clearSearch,
    matchCount: results.length,
  };
}
