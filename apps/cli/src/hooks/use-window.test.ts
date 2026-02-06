import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import {
  useWindowSize,
  useLayoutSizes,
  useResizable,
  useTerminalCursor,
  useAlternateScreen,
} from './use-window';

// Mock useStdout from ink
const mockStdout = {
  columns: 120,
  rows: 40,
  on: vi.fn(),
  off: vi.fn(),
  write: vi.fn(),
};

vi.mock('ink', () => ({
  useStdout: () => ({ stdout: mockStdout }),
}));

describe('useWindowSize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStdout.columns = 120;
    mockStdout.rows = 40;
  });

  it('returns current window dimensions', () => {
    const { result } = renderHook(() => useWindowSize());

    expect(result.current.width).toBe(120);
    expect(result.current.height).toBe(40);
    expect(result.current.columns).toBe(120);
    expect(result.current.rows).toBe(40);
  });

  it('categorizes screen size correctly', () => {
    const { result } = renderHook(() => useWindowSize());

    expect(result.current.isSmall).toBe(false);
    expect(result.current.isMedium).toBe(false);
    expect(result.current.isLarge).toBe(true);
  });

  it('identifies small screens', () => {
    mockStdout.columns = 60;
    const { result } = renderHook(() => useWindowSize());

    expect(result.current.isSmall).toBe(true);
    expect(result.current.isMedium).toBe(false);
    expect(result.current.isLarge).toBe(false);
  });

  it('identifies medium screens', () => {
    mockStdout.columns = 100;
    const { result } = renderHook(() => useWindowSize());

    expect(result.current.isSmall).toBe(false);
    expect(result.current.isMedium).toBe(true);
    expect(result.current.isLarge).toBe(false);
  });

  it('registers resize listener', () => {
    renderHook(() => useWindowSize());

    expect(mockStdout.on).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('unregisters resize listener on unmount', () => {
    const { unmount } = renderHook(() => useWindowSize());

    unmount();

    expect(mockStdout.off).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});

describe('useLayoutSizes', () => {
  beforeEach(() => {
    mockStdout.columns = 120;
    mockStdout.rows = 40;
  });

  it('calculates default layout sizes', () => {
    mockStdout.rows = 60; // Set larger height to avoid 1/3 limit
    const { result } = renderHook(() => useLayoutSizes());

    expect(result.current.sidebarWidth).toBe(20);
    expect(result.current.mainWidth).toBe(100); // 120 - 20
    expect(result.current.detailHeight).toBe(15);
  });

  it('handles collapsed sidebar', () => {
    const { result } = renderHook(() =>
      useLayoutSizes({ sidebarCollapsed: true })
    );

    expect(result.current.sidebarWidth).toBe(0);
    expect(result.current.mainWidth).toBe(120);
  });

  it('handles collapsed detail panel', () => {
    const { result } = renderHook(() =>
      useLayoutSizes({ detailCollapsed: true })
    );

    expect(result.current.detailHeight).toBe(5); // minDetailHeight
  });

  it('limits sidebar to 1/3 of width', () => {
    mockStdout.columns = 60;
    const { result } = renderHook(() =>
      useLayoutSizes({ sidebarWidth: 30 })
    );

    expect(result.current.sidebarWidth).toBe(20); // 60 / 3
  });

  it('limits detail to 1/3 of height', () => {
    mockStdout.rows = 30;
    const { result } = renderHook(() =>
      useLayoutSizes({ detailHeight: 20 })
    );

    expect(result.current.detailHeight).toBe(10); // 30 / 3
  });
});

describe('useResizable', () => {
  beforeEach(() => {
    mockStdout.columns = 120;
    mockStdout.rows = 40;
  });

  it('initializes with initial size', () => {
    const { result } = renderHook(() =>
      useResizable({ initialSize: 30, direction: 'horizontal' })
    );

    expect(result.current.size).toBe(30);
    expect(result.current.isResizing).toBe(false);
  });

  it('resizes within bounds', () => {
    const { result } = renderHook(() =>
      useResizable({ initialSize: 30, minSize: 20, maxSize: 50, direction: 'horizontal' })
    );

    act(() => {
      result.current.resize(10);
    });

    expect(result.current.size).toBe(40);
  });

  it('respects min size', () => {
    const { result } = renderHook(() =>
      useResizable({ initialSize: 30, minSize: 20, direction: 'horizontal' })
    );

    act(() => {
      result.current.resize(-20);
    });

    expect(result.current.size).toBe(20);
  });

  it('respects max size', () => {
    const { result } = renderHook(() =>
      useResizable({ initialSize: 30, maxSize: 50, direction: 'horizontal' })
    );

    act(() => {
      result.current.resize(30);
    });

    expect(result.current.size).toBe(50);
  });

  it('sets size directly', () => {
    const { result } = renderHook(() =>
      useResizable({ initialSize: 30, direction: 'horizontal' })
    );

    act(() => {
      result.current.setSize(45);
    });

    expect(result.current.size).toBe(45);
  });

  it('tracks resizing state', () => {
    const { result } = renderHook(() =>
      useResizable({ initialSize: 30, direction: 'horizontal' })
    );

    expect(result.current.isResizing).toBe(false);

    act(() => {
      result.current.startResize();
    });

    expect(result.current.isResizing).toBe(true);

    act(() => {
      result.current.endResize();
    });

    expect(result.current.isResizing).toBe(false);
  });

  it('resets to initial size', () => {
    const { result } = renderHook(() =>
      useResizable({ initialSize: 30, direction: 'horizontal' })
    );

    act(() => {
      result.current.resize(20);
    });

    expect(result.current.size).toBe(50);

    act(() => {
      result.current.reset();
    });

    expect(result.current.size).toBe(30);
  });
});

describe('useTerminalCursor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows cursor', () => {
    const { result } = renderHook(() => useTerminalCursor());

    act(() => {
      result.current.show();
    });

    expect(mockStdout.write).toHaveBeenCalledWith('\x1B[?25h');
    expect(result.current.isVisible).toBe(true);
  });

  it('hides cursor', () => {
    const { result } = renderHook(() => useTerminalCursor());

    act(() => {
      result.current.hide();
    });

    expect(mockStdout.write).toHaveBeenCalledWith('\x1B[?25l');
    expect(result.current.isVisible).toBe(false);
  });

  it('restores cursor on unmount', () => {
    const { unmount } = renderHook(() => useTerminalCursor());

    unmount();

    expect(mockStdout.write).toHaveBeenCalledWith('\x1B[?25h');
  });
});

describe('useAlternateScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enters alternate screen', () => {
    const { result } = renderHook(() => useAlternateScreen());

    act(() => {
      result.current.enter();
    });

    expect(mockStdout.write).toHaveBeenCalledWith('\x1B[?1049h');
    expect(result.current.isActive).toBe(true);
  });

  it('leaves alternate screen', () => {
    const { result } = renderHook(() => useAlternateScreen());

    act(() => {
      result.current.enter();
    });

    act(() => {
      result.current.leave();
    });

    expect(mockStdout.write).toHaveBeenCalledWith('\x1B[?1049l');
    expect(result.current.isActive).toBe(false);
  });
});
