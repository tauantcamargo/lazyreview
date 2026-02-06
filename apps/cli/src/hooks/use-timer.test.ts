import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTimer, useInterval } from './use-timer';

describe('useTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with default values', () => {
    const { result } = renderHook(() =>
      useTimer({ interval: 1000 })
    );

    expect(result.current.isRunning).toBe(false);
    expect(result.current.elapsed).toBe(0);
  });

  it('auto-starts when autoStart is true', () => {
    const { result } = renderHook(() =>
      useTimer({ interval: 1000, autoStart: true })
    );

    expect(result.current.isRunning).toBe(true);
  });

  it('starts timer on start()', () => {
    const { result } = renderHook(() =>
      useTimer({ interval: 1000 })
    );

    act(() => {
      result.current.start();
    });

    expect(result.current.isRunning).toBe(true);
  });

  it('stops timer on stop()', () => {
    const { result } = renderHook(() =>
      useTimer({ interval: 1000, autoStart: true })
    );

    act(() => {
      result.current.stop();
    });

    expect(result.current.isRunning).toBe(false);
  });

  it('increments elapsed time', () => {
    const { result } = renderHook(() =>
      useTimer({ interval: 1000, autoStart: true })
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.elapsed).toBe(3000);
  });

  it('calls onTick callback', () => {
    const onTick = vi.fn();
    renderHook(() =>
      useTimer({ interval: 1000, autoStart: true, onTick })
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onTick).toHaveBeenCalledTimes(3);
  });

  it('resets elapsed time on reset()', () => {
    const { result } = renderHook(() =>
      useTimer({ interval: 1000, autoStart: true })
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.elapsed).toBe(2000);

    act(() => {
      result.current.reset();
    });

    expect(result.current.elapsed).toBe(0);
  });

  it('restarts timer on restart()', () => {
    const { result } = renderHook(() =>
      useTimer({ interval: 1000, autoStart: true })
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.elapsed).toBe(2000);

    act(() => {
      result.current.stop();
    });
    expect(result.current.isRunning).toBe(false);

    act(() => {
      result.current.restart();
    });

    expect(result.current.isRunning).toBe(true);
    expect(result.current.elapsed).toBe(0);

    // Verify it continues counting after restart
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.elapsed).toBe(1000);
  });

  it('stops incrementing when stopped', () => {
    const { result } = renderHook(() =>
      useTimer({ interval: 1000, autoStart: true })
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.elapsed).toBe(2000);

    act(() => {
      result.current.stop();
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.elapsed).toBe(2000);
  });

  it('cleans up on unmount', () => {
    const onTick = vi.fn();
    const { unmount } = renderHook(() =>
      useTimer({ interval: 1000, autoStart: true, onTick })
    );

    unmount();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Should only have been called before unmount, not after
    expect(onTick).toHaveBeenCalledTimes(0);
  });
});

describe('useInterval', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls callback at interval', () => {
    const callback = vi.fn();
    renderHook(() =>
      useInterval({ callback, delay: 1000 })
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('does not call callback when delay is null', () => {
    const callback = vi.fn();
    renderHook(() =>
      useInterval({ callback, delay: null })
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('calls callback immediately when immediate is true', () => {
    const callback = vi.fn();
    renderHook(() =>
      useInterval({ callback, delay: 1000, immediate: true })
    );

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('updates callback reference', () => {
    let count = 0;
    const callback1 = vi.fn(() => { count = 1; });
    const callback2 = vi.fn(() => { count = 2; });

    const { rerender } = renderHook(
      ({ callback }) => useInterval({ callback, delay: 1000 }),
      { initialProps: { callback: callback1 } }
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(count).toBe(1);

    rerender({ callback: callback2 });

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(count).toBe(2);
  });

  it('cleans up on unmount', () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() =>
      useInterval({ callback, delay: 1000 })
    );

    unmount();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(callback).toHaveBeenCalledTimes(0);
  });

  it('cleans up when delay changes to null', () => {
    const callback = vi.fn();
    const { rerender } = renderHook(
      ({ delay }) => useInterval({ callback, delay }),
      { initialProps: { delay: 1000 as number | null } }
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(callback).toHaveBeenCalledTimes(2);

    rerender({ delay: null });

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(callback).toHaveBeenCalledTimes(2); // No new calls
  });
});
