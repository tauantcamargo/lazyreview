import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNavigation } from './use-navigation';

describe('useNavigation', () => {
  it('initializes with default index 0', () => {
    const { result } = renderHook(() =>
      useNavigation({ itemCount: 10, pageSize: 5 })
    );
    expect(result.current.selectedIndex).toBe(0);
    expect(result.current.offset).toBe(0);
  });

  it('initializes with provided initial index', () => {
    const { result } = renderHook(() =>
      useNavigation({ itemCount: 10, pageSize: 5, initialIndex: 3 })
    );
    expect(result.current.selectedIndex).toBe(3);
  });

  it('clamps initial index to valid range', () => {
    const { result } = renderHook(() =>
      useNavigation({ itemCount: 5, pageSize: 5, initialIndex: 10 })
    );
    expect(result.current.selectedIndex).toBe(4);
  });

  it('moves down correctly', () => {
    const { result } = renderHook(() =>
      useNavigation({ itemCount: 10, pageSize: 5 })
    );

    act(() => {
      result.current.moveDown();
    });
    expect(result.current.selectedIndex).toBe(1);

    act(() => {
      result.current.moveDown();
    });
    expect(result.current.selectedIndex).toBe(2);
  });

  it('moves up correctly', () => {
    const { result } = renderHook(() =>
      useNavigation({ itemCount: 10, pageSize: 5, initialIndex: 5 })
    );

    act(() => {
      result.current.moveUp();
    });
    expect(result.current.selectedIndex).toBe(4);
  });

  it('does not move below 0', () => {
    const { result } = renderHook(() =>
      useNavigation({ itemCount: 10, pageSize: 5 })
    );

    act(() => {
      result.current.moveUp();
    });
    expect(result.current.selectedIndex).toBe(0);
  });

  it('does not move beyond item count', () => {
    const { result } = renderHook(() =>
      useNavigation({ itemCount: 5, pageSize: 5, initialIndex: 4 })
    );

    act(() => {
      result.current.moveDown();
    });
    expect(result.current.selectedIndex).toBe(4);
  });

  it('pages down correctly', () => {
    const { result } = renderHook(() =>
      useNavigation({ itemCount: 20, pageSize: 5 })
    );

    act(() => {
      result.current.pageDown();
    });
    expect(result.current.selectedIndex).toBe(5);
  });

  it('pages up correctly', () => {
    const { result } = renderHook(() =>
      useNavigation({ itemCount: 20, pageSize: 5, initialIndex: 10 })
    );

    act(() => {
      result.current.pageUp();
    });
    expect(result.current.selectedIndex).toBe(5);
  });

  it('goes to top', () => {
    const { result } = renderHook(() =>
      useNavigation({ itemCount: 20, pageSize: 5, initialIndex: 15 })
    );

    act(() => {
      result.current.goToTop();
    });
    expect(result.current.selectedIndex).toBe(0);
    expect(result.current.offset).toBe(0);
  });

  it('goes to bottom', () => {
    const { result } = renderHook(() =>
      useNavigation({ itemCount: 20, pageSize: 5 })
    );

    act(() => {
      result.current.goToBottom();
    });
    expect(result.current.selectedIndex).toBe(19);
  });

  it('sets index correctly', () => {
    const { result } = renderHook(() =>
      useNavigation({ itemCount: 10, pageSize: 5 })
    );

    act(() => {
      result.current.setIndex(7);
    });
    expect(result.current.selectedIndex).toBe(7);
  });

  it('clamps setIndex to valid range', () => {
    const { result } = renderHook(() =>
      useNavigation({ itemCount: 10, pageSize: 5 })
    );

    act(() => {
      result.current.setIndex(100);
    });
    expect(result.current.selectedIndex).toBe(9);

    act(() => {
      result.current.setIndex(-5);
    });
    expect(result.current.selectedIndex).toBe(0);
  });

  it('resets to initial state', () => {
    const { result } = renderHook(() =>
      useNavigation({ itemCount: 10, pageSize: 5, initialIndex: 5 })
    );

    act(() => {
      result.current.moveDown();
      result.current.moveDown();
    });
    expect(result.current.selectedIndex).toBe(7);

    act(() => {
      result.current.reset();
    });
    expect(result.current.selectedIndex).toBe(0);
    expect(result.current.offset).toBe(0);
  });

  // Tests for navigate* function aliases
  it('navigateUp is an alias for moveUp', () => {
    const { result } = renderHook(() =>
      useNavigation({ itemCount: 10, pageSize: 5, initialIndex: 5 })
    );

    act(() => {
      result.current.navigateUp();
    });
    expect(result.current.selectedIndex).toBe(4);
  });

  it('navigateDown is an alias for moveDown', () => {
    const { result } = renderHook(() =>
      useNavigation({ itemCount: 10, pageSize: 5 })
    );

    act(() => {
      result.current.navigateDown();
    });
    expect(result.current.selectedIndex).toBe(1);
  });

  it('navigateToTop is an alias for goToTop', () => {
    const { result } = renderHook(() =>
      useNavigation({ itemCount: 20, pageSize: 5, initialIndex: 15 })
    );

    act(() => {
      result.current.navigateToTop();
    });
    expect(result.current.selectedIndex).toBe(0);
  });

  it('navigateToBottom is an alias for goToBottom', () => {
    const { result } = renderHook(() =>
      useNavigation({ itemCount: 20, pageSize: 5 })
    );

    act(() => {
      result.current.navigateToBottom();
    });
    expect(result.current.selectedIndex).toBe(19);
  });

  // Tests for external state management
  describe('with external state', () => {
    it('uses external selectedIndex', () => {
      const { result } = renderHook(() =>
        useNavigation({
          itemCount: 10,
          pageSize: 5,
          selectedIndex: 3,
          onIndexChange: () => {},
        })
      );
      expect(result.current.selectedIndex).toBe(3);
    });

    it('calls onIndexChange when navigating', () => {
      const onIndexChange = vi.fn();
      const { result } = renderHook(() =>
        useNavigation({
          itemCount: 10,
          pageSize: 5,
          selectedIndex: 5,
          onIndexChange,
        })
      );

      act(() => {
        result.current.navigateDown();
      });
      expect(onIndexChange).toHaveBeenCalledWith(6);
    });

    it('calls onIndexChange when navigating up', () => {
      const onIndexChange = vi.fn();
      const { result } = renderHook(() =>
        useNavigation({
          itemCount: 10,
          pageSize: 5,
          selectedIndex: 5,
          onIndexChange,
        })
      );

      act(() => {
        result.current.navigateUp();
      });
      expect(onIndexChange).toHaveBeenCalledWith(4);
    });
  });
});
