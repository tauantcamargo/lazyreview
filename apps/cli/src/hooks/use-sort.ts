import { useState, useMemo, useCallback } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig<T> {
  field: keyof T;
  direction: SortDirection;
}

export interface UseSortOptions<T> {
  items: T[];
  initialSort?: SortConfig<T>;
}

export interface UseSortResult<T> {
  sortedItems: T[];
  sortConfig: SortConfig<T> | null;
  sortBy: (field: keyof T) => void;
  toggleDirection: () => void;
  clearSort: () => void;
  isSortedBy: (field: keyof T) => boolean;
}

function compareValues<T>(a: T, b: T, field: keyof T, direction: SortDirection): number {
  const valueA = a[field];
  const valueB = b[field];

  // Handle null/undefined
  if (valueA === null || valueA === undefined) return direction === 'asc' ? -1 : 1;
  if (valueB === null || valueB === undefined) return direction === 'asc' ? 1 : -1;

  // Compare strings
  if (typeof valueA === 'string' && typeof valueB === 'string') {
    const comparison = valueA.localeCompare(valueB);
    return direction === 'asc' ? comparison : -comparison;
  }

  // Compare numbers
  if (typeof valueA === 'number' && typeof valueB === 'number') {
    return direction === 'asc' ? valueA - valueB : valueB - valueA;
  }

  // Compare dates (as strings)
  if (valueA instanceof Date && valueB instanceof Date) {
    const comparison = valueA.getTime() - valueB.getTime();
    return direction === 'asc' ? comparison : -comparison;
  }

  // Fallback to string comparison
  const strA = String(valueA);
  const strB = String(valueB);
  const comparison = strA.localeCompare(strB);
  return direction === 'asc' ? comparison : -comparison;
}

export function useSort<T>({
  items,
  initialSort,
}: UseSortOptions<T>): UseSortResult<T> {
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(initialSort ?? null);

  const sortedItems = useMemo(() => {
    if (!sortConfig) {
      return items;
    }

    return [...items].sort((a, b) =>
      compareValues(a, b, sortConfig.field, sortConfig.direction)
    );
  }, [items, sortConfig]);

  const sortBy = useCallback((field: keyof T) => {
    setSortConfig((current) => {
      if (current && current.field === field) {
        // Toggle direction if same field
        return {
          field,
          direction: current.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      // New field, default to ascending
      return { field, direction: 'asc' };
    });
  }, []);

  const toggleDirection = useCallback(() => {
    setSortConfig((current) => {
      if (!current) return null;
      return {
        ...current,
        direction: current.direction === 'asc' ? 'desc' : 'asc',
      };
    });
  }, []);

  const clearSort = useCallback(() => {
    setSortConfig(null);
  }, []);

  const isSortedBy = useCallback(
    (field: keyof T): boolean => {
      return sortConfig?.field === field;
    },
    [sortConfig]
  );

  return {
    sortedItems,
    sortConfig,
    sortBy,
    toggleDirection,
    clearSort,
    isSortedBy,
  };
}
