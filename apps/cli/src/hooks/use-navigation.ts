import { useState, useCallback } from 'react';

export interface NavigationState {
  selectedIndex: number;
  offset: number;
}

export interface UseNavigationOptions {
  itemCount: number;
  pageSize: number;
  initialIndex?: number;
}

export interface UseNavigationResult {
  selectedIndex: number;
  offset: number;
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
  pageSize,
  initialIndex = 0,
}: UseNavigationOptions): UseNavigationResult {
  const [selectedIndex, setSelectedIndex] = useState(
    Math.min(initialIndex, Math.max(0, itemCount - 1))
  );
  const [offset, setOffset] = useState(0);

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

  const moveUp = useCallback(() => {
    setSelectedIndex((prev) => {
      const next = Math.max(0, prev - 1);
      ensureVisible(next);
      return next;
    });
  }, [ensureVisible]);

  const moveDown = useCallback(() => {
    setSelectedIndex((prev) => {
      const next = Math.min(itemCount - 1, prev + 1);
      ensureVisible(next);
      return next;
    });
  }, [itemCount, ensureVisible]);

  const pageUp = useCallback(() => {
    setSelectedIndex((prev) => {
      const next = Math.max(0, prev - pageSize);
      setOffset((o) => Math.max(0, o - pageSize));
      return next;
    });
  }, [pageSize]);

  const pageDown = useCallback(() => {
    setSelectedIndex((prev) => {
      const next = Math.min(itemCount - 1, prev + pageSize);
      setOffset((o) => Math.min(Math.max(0, itemCount - pageSize), o + pageSize));
      return next;
    });
  }, [itemCount, pageSize]);

  const goToTop = useCallback(() => {
    setSelectedIndex(0);
    setOffset(0);
  }, []);

  const goToBottom = useCallback(() => {
    const lastIndex = Math.max(0, itemCount - 1);
    setSelectedIndex(lastIndex);
    setOffset(Math.max(0, itemCount - pageSize));
  }, [itemCount, pageSize]);

  const setIndex = useCallback(
    (index: number) => {
      const validIndex = Math.max(0, Math.min(itemCount - 1, index));
      setSelectedIndex(validIndex);
      ensureVisible(validIndex);
    },
    [itemCount, ensureVisible]
  );

  const reset = useCallback(() => {
    setSelectedIndex(0);
    setOffset(0);
  }, []);

  return {
    selectedIndex,
    offset,
    moveUp,
    moveDown,
    pageUp,
    pageDown,
    goToTop,
    goToBottom,
    setIndex,
    reset,
  };
}
