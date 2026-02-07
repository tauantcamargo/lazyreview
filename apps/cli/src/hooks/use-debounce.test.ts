import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useDebounce,
  useDebouncedCallback,
  useThrottle,
  useThrottledCallback,
} from './use-debounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));

    expect(result.current).toBe('initial');
  });

  it('debounces value changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'first' } }
    );

    expect(result.current).toBe('first');

    rerender({ value: 'second' });
    expect(result.current).toBe('first');

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('first');

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('second');
  });

  it('resets timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'first' } }
    );

    rerender({ value: 'second' });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    rerender({ value: 'third' });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Still the first value because timer was reset
    expect(result.current).toBe('first');

    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Now it's third
    expect(result.current).toBe('third');
  });

  it('supports leading option', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500, { leading: true }),
      { initialProps: { value: 'first' } }
    );

    expect(result.current).toBe('first');

    rerender({ value: 'second' });

    // With leading, the first change should update immediately
    // But subsequent changes should be debounced
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe('second');
  });
});

describe('useDebouncedCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces callback execution', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 500));

    result.current('arg1');
    result.current('arg2');
    result.current('arg3');

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('arg3');
  });

  it('resets timer on each call', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 500));

    result.current('arg1');

    act(() => {
      vi.advanceTimersByTime(300);
    });

    result.current('arg2');

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('arg2');
  });

  it('cleans up on unmount', () => {
    const callback = vi.fn();
    const { result, unmount } = renderHook(() =>
      useDebouncedCallback(callback, 500)
    );

    result.current('arg');
    unmount();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(callback).not.toHaveBeenCalled();
  });
});

describe('useThrottle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useThrottle('initial', 500));

    expect(result.current).toBe('initial');
  });

  it('eventually updates value after throttle period', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useThrottle(value, 500),
      { initialProps: { value: 'first' } }
    );

    expect(result.current).toBe('first');

    // Change value while still within throttle period
    rerender({ value: 'second' });
    expect(result.current).toBe('first');

    // Wait for trailing update
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Should now be updated
    expect(result.current).toBe('second');
  });

  it('throttles rapid value changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useThrottle(value, 500),
      { initialProps: { value: 'first' } }
    );

    expect(result.current).toBe('first');

    rerender({ value: 'second' });

    // Should still be first because within throttle limit
    expect(result.current).toBe('first');

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Now second should be applied (trailing)
    expect(result.current).toBe('second');
  });

  it('respects leading option', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useThrottle(value, 500, { leading: true, trailing: false }),
      { initialProps: { value: 'first' } }
    );

    act(() => {
      vi.advanceTimersByTime(600);
    });

    rerender({ value: 'second' });

    // With leading, should update immediately
    expect(result.current).toBe('second');
  });
});

describe('useThrottledCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('executes immediately on first call', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(callback, 500));

    result.current('arg1');

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('arg1');
  });

  it('throttles subsequent calls', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(callback, 500));

    result.current('arg1');
    result.current('arg2');
    result.current('arg3');

    // Only first call should have executed
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('arg1');

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Now trailing call should execute
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith('arg3');
  });

  it('allows calls after throttle period', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(callback, 500));

    result.current('arg1');
    expect(callback).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    result.current('arg2');
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith('arg2');
  });

  it('cleans up on unmount', () => {
    const callback = vi.fn();
    const { result, unmount } = renderHook(() =>
      useThrottledCallback(callback, 500)
    );

    result.current('arg1');
    result.current('arg2'); // This sets up a trailing timeout

    unmount();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Only the first immediate call should have happened
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
