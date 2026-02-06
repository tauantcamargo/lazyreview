import { useState, useEffect, useCallback, useMemo } from 'react';
import { useStdout } from 'ink';

export interface WindowSize {
  width: number;
  height: number;
}

export interface UseWindowSizeResult extends WindowSize {
  columns: number;
  rows: number;
  isSmall: boolean;
  isMedium: boolean;
  isLarge: boolean;
}

/**
 * Hook to get the current terminal window size
 */
export function useWindowSize(): UseWindowSizeResult {
  const { stdout } = useStdout();

  const [size, setSize] = useState<WindowSize>(() => ({
    width: stdout?.columns ?? 80,
    height: stdout?.rows ?? 24,
  }));

  useEffect(() => {
    if (!stdout) return;

    const handleResize = () => {
      setSize({
        width: stdout.columns,
        height: stdout.rows,
      });
    };

    stdout.on('resize', handleResize);

    // Set initial size
    handleResize();

    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout]);

  return useMemo(() => ({
    ...size,
    columns: size.width,
    rows: size.height,
    isSmall: size.width < 80,
    isMedium: size.width >= 80 && size.width < 120,
    isLarge: size.width >= 120,
  }), [size]);
}

export interface SplitSizes {
  sidebar: number;
  main: number;
  detail: number;
}

export interface UseLayoutSizesOptions {
  sidebarWidth?: number;
  detailHeight?: number;
  minMainWidth?: number;
  minDetailHeight?: number;
  sidebarCollapsed?: boolean;
  detailCollapsed?: boolean;
}

export interface UseLayoutSizesResult {
  sizes: SplitSizes;
  sidebarWidth: number;
  mainWidth: number;
  detailHeight: number;
  mainHeight: number;
  contentWidth: number;
  contentHeight: number;
}

/**
 * Hook to calculate layout panel sizes based on window size
 */
export function useLayoutSizes(options: UseLayoutSizesOptions = {}): UseLayoutSizesResult {
  const {
    sidebarWidth = 20,
    detailHeight = 15,
    minMainWidth = 40,
    minDetailHeight = 5,
    sidebarCollapsed = false,
    detailCollapsed = false,
  } = options;

  const windowSize = useWindowSize();

  return useMemo(() => {
    const actualSidebarWidth = sidebarCollapsed ? 0 : Math.min(sidebarWidth, windowSize.width / 3);
    const actualDetailHeight = detailCollapsed ? 0 : Math.min(detailHeight, windowSize.height / 3);

    // Calculate available space
    const availableWidth = windowSize.width - actualSidebarWidth;
    const availableHeight = windowSize.height - actualDetailHeight - 1; // -1 for status bar

    // Main panel gets remaining space
    const mainWidth = Math.max(availableWidth, minMainWidth);
    const mainHeight = Math.max(availableHeight - minDetailHeight, minDetailHeight);

    return {
      sizes: {
        sidebar: actualSidebarWidth,
        main: mainWidth,
        detail: Math.max(actualDetailHeight, minDetailHeight),
      },
      sidebarWidth: actualSidebarWidth,
      mainWidth,
      detailHeight: Math.max(actualDetailHeight, minDetailHeight),
      mainHeight,
      contentWidth: windowSize.width,
      contentHeight: windowSize.height,
    };
  }, [windowSize, sidebarWidth, detailHeight, minMainWidth, minDetailHeight, sidebarCollapsed, detailCollapsed]);
}

export interface UseResizableOptions {
  initialSize: number;
  minSize?: number;
  maxSize?: number;
  direction: 'horizontal' | 'vertical';
}

export interface UseResizableResult {
  size: number;
  isResizing: boolean;
  resize: (delta: number) => void;
  setSize: (size: number) => void;
  startResize: () => void;
  endResize: () => void;
  reset: () => void;
}

/**
 * Hook for resizable panels
 */
export function useResizable(options: UseResizableOptions): UseResizableResult {
  const { initialSize, minSize = 10, maxSize = 100, direction } = options;

  const windowSize = useWindowSize();
  const maxDimension = direction === 'horizontal' ? windowSize.width : windowSize.height;

  const [size, setSize] = useState(initialSize);
  const [isResizing, setIsResizing] = useState(false);

  const clampedMaxSize = Math.min(maxSize, maxDimension - minSize);

  const resize = useCallback((delta: number) => {
    setSize((prev) => {
      const newSize = prev + delta;
      return Math.max(minSize, Math.min(newSize, clampedMaxSize));
    });
  }, [minSize, clampedMaxSize]);

  const setSizeWithClamp = useCallback((newSize: number) => {
    setSize(Math.max(minSize, Math.min(newSize, clampedMaxSize)));
  }, [minSize, clampedMaxSize]);

  const startResize = useCallback(() => {
    setIsResizing(true);
  }, []);

  const endResize = useCallback(() => {
    setIsResizing(false);
  }, []);

  const reset = useCallback(() => {
    setSize(initialSize);
  }, [initialSize]);

  return {
    size,
    isResizing,
    resize,
    setSize: setSizeWithClamp,
    startResize,
    endResize,
    reset,
  };
}

export interface UseTerminalCursorResult {
  show: () => void;
  hide: () => void;
  isVisible: boolean;
}

/**
 * Hook to control terminal cursor visibility
 */
export function useTerminalCursor(): UseTerminalCursorResult {
  const { stdout } = useStdout();
  const [isVisible, setIsVisible] = useState(true);

  const show = useCallback(() => {
    if (stdout) {
      stdout.write('\x1B[?25h');
      setIsVisible(true);
    }
  }, [stdout]);

  const hide = useCallback(() => {
    if (stdout) {
      stdout.write('\x1B[?25l');
      setIsVisible(false);
    }
  }, [stdout]);

  // Ensure cursor is visible on unmount
  useEffect(() => {
    return () => {
      if (stdout) {
        stdout.write('\x1B[?25h');
      }
    };
  }, [stdout]);

  return { show, hide, isVisible };
}

export interface AlternateScreenResult {
  enter: () => void;
  leave: () => void;
  isActive: boolean;
}

/**
 * Hook to manage alternate screen buffer
 */
export function useAlternateScreen(): AlternateScreenResult {
  const { stdout } = useStdout();
  const [isActive, setIsActive] = useState(false);

  const enter = useCallback(() => {
    if (stdout) {
      stdout.write('\x1B[?1049h');
      setIsActive(true);
    }
  }, [stdout]);

  const leave = useCallback(() => {
    if (stdout) {
      stdout.write('\x1B[?1049l');
      setIsActive(false);
    }
  }, [stdout]);

  // Leave alternate screen on unmount
  useEffect(() => {
    return () => {
      if (stdout && isActive) {
        stdout.write('\x1B[?1049l');
      }
    };
  }, [stdout, isActive]);

  return { enter, leave, isActive };
}
