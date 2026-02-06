import { describe, it, expect } from 'vitest';
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
});
