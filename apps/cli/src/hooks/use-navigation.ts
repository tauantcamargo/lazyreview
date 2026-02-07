import { useState, useCallback } from 'react';

export interface NavigationState {
  selectedIndex: number;
  offset: number;
}

export interface UseNavigationOptions {
  itemCount: number;
  pageSize?: number;
  initialIndex?: number;
  // For external state management (e.g., Zustand)
  selectedIndex?: number;
  onIndexChange?: (index: number) => void;
}

export interface UseNavigationResult {
  selectedIndex: number;
  offset: number;
  // Primary navigation functions (used by screens)
  navigateUp: () => void;
  navigateDown: () => void;
  navigateToTop: () => void;
  navigateToBottom: () => void;
  // Aliases for backward compatibility
  moveUp: () => void;
  moveDown: () => void;
  pageUp: () => void;
  pageDown: () => void;
  goToTop: () => void;
  goToBottom: () => void;
  setIndex: (index: number) => void;
  reset: () => void;
}

export function useNavigation({
  itemCount,
  pageSize = 10,
  initialIndex = 0,
  selectedIndex: externalIndex,
  onIndexChange,
}: UseNavigationOptions): UseNavigationResult {
  // Use external state if provided, otherwise use internal state
  const [internalIndex, setInternalIndex] = useState(
    Math.min(initialIndex, Math.max(0, itemCount - 1))
  );
  const [offset, setOffset] = useState(0);

  // Determine which index to use
  const selectedIndex = externalIndex ?? internalIndex;

  const ensureVisible = useCallback(
    (index: number) => {
      if (index < offset) {
        setOffset(index);
      } else if (index >= offset + pageSize) {
        setOffset(index - pageSize + 1);
      }
    },
    [offset, pageSize]
  );

  const navigateUp = useCallback(() => {
    if (onIndexChange) {
      // External state management - use current value
      const next = Math.max(0, selectedIndex - 1);
      onIndexChange(next);
      ensureVisible(next);
    } else {
      // Internal state - use functional update
      setInternalIndex((prev) => {
        const next = Math.max(0, prev - 1);
        ensureVisible(next);
        return next;
      });
    }
  }, [selectedIndex, onIndexChange, ensureVisible]);

  const navigateDown = useCallback(() => {
    if (onIndexChange) {
      // External state management
      const next = Math.min(Math.max(0, itemCount - 1), selectedIndex + 1);
      onIndexChange(next);
      ensureVisible(next);
    } else {
      // Internal state - use functional update
      setInternalIndex((prev) => {
        const next = Math.min(Math.max(0, itemCount - 1), prev + 1);
        ensureVisible(next);
        return next;
      });
    }
  }, [itemCount, selectedIndex, onIndexChange, ensureVisible]);

  const pageUp = useCallback(() => {
    if (onIndexChange) {
      const next = Math.max(0, selectedIndex - pageSize);
      onIndexChange(next);
    } else {
      setInternalIndex((prev) => Math.max(0, prev - pageSize));
    }
    setOffset((o) => Math.max(0, o - pageSize));
  }, [selectedIndex, onIndexChange, pageSize]);

  const pageDown = useCallback(() => {
    if (onIndexChange) {
      const next = Math.min(Math.max(0, itemCount - 1), selectedIndex + pageSize);
      onIndexChange(next);
    } else {
      setInternalIndex((prev) => Math.min(Math.max(0, itemCount - 1), prev + pageSize));
    }
    setOffset((o) => Math.min(Math.max(0, itemCount - pageSize), o + pageSize));
  }, [itemCount, selectedIndex, onIndexChange, pageSize]);

  const navigateToTop = useCallback(() => {
    if (onIndexChange) {
      onIndexChange(0);
    } else {
      setInternalIndex(0);
    }
    setOffset(0);
  }, [onIndexChange]);

  const navigateToBottom = useCallback(() => {
    const lastIndex = Math.max(0, itemCount - 1);
    if (onIndexChange) {
      onIndexChange(lastIndex);
    } else {
      setInternalIndex(lastIndex);
    }
    setOffset(Math.max(0, itemCount - pageSize));
  }, [itemCount, onIndexChange, pageSize]);

  const setIndex = useCallback(
    (index: number) => {
      const validIndex = Math.max(0, Math.min(itemCount - 1, index));
      if (onIndexChange) {
        onIndexChange(validIndex);
      } else {
        setInternalIndex(validIndex);
      }
      ensureVisible(validIndex);
    },
    [itemCount, onIndexChange, ensureVisible]
  );

  const reset = useCallback(() => {
    if (onIndexChange) {
      onIndexChange(0);
    } else {
      setInternalIndex(0);
    }
    setOffset(0);
  }, [onIndexChange]);

  return {
    selectedIndex,
    offset,
    // Primary navigation functions
    navigateUp,
    navigateDown,
    navigateToTop,
    navigateToBottom,
    // Aliases for backward compatibility
    moveUp: navigateUp,
    moveDown: navigateDown,
    pageUp,
    pageDown,
    goToTop: navigateToTop,
    goToBottom: navigateToBottom,
    setIndex,
    reset,
  };
}
