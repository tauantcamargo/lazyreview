import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAsync, usePolling, useAsyncWithRetry } from './use-async';

describe('useAsync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with idle state', () => {
    const asyncFn = vi.fn().mockResolvedValue('data');
    const { result } = renderHook(() => useAsync(asyncFn));

    expect(result.current.status).toBe('idle');
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isIdle).toBe(true);
  });

  it('transitions to loading when executing', async () => {
    const asyncFn = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve('data'), 100))
    );
    const { result } = renderHook(() => useAsync(asyncFn));

    act(() => {
      result.current.execute();
    });

    expect(result.current.status).toBe('loading');
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.status).toBe('success');
  });

  it('transitions to success with data', async () => {
    const asyncFn = vi.fn().mockResolvedValue('result data');
    const { result } = renderHook(() => useAsync(asyncFn));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.status).toBe('success');
    expect(result.current.data).toBe('result data');
    expect(result.current.isSuccess).toBe(true);
  });

  it('transitions to error on failure', async () => {
    const error = new Error('Failed');
    const asyncFn = vi.fn().mockRejectedValue(error);
    const { result } = renderHook(() => useAsync(asyncFn));

    await act(async () => {
      try {
        await result.current.execute();
      } catch {
        // Expected
      }
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe(error);
    expect(result.current.isError).toBe(true);
  });

  it('calls onSuccess callback', async () => {
    const onSuccess = vi.fn();
    const asyncFn = vi.fn().mockResolvedValue('data');
    const { result } = renderHook(() => useAsync(asyncFn, { onSuccess }));

    await act(async () => {
      await result.current.execute();
    });

    expect(onSuccess).toHaveBeenCalledWith('data');
  });

  it('calls onError callback', async () => {
    const onError = vi.fn();
    const error = new Error('Failed');
    const asyncFn = vi.fn().mockRejectedValue(error);
    const { result } = renderHook(() => useAsync(asyncFn, { onError }));

    await act(async () => {
      try {
        await result.current.execute();
      } catch {
        // Expected
      }
    });

    expect(onError).toHaveBeenCalledWith(error);
  });

  it('executes immediately when requested', async () => {
    const asyncFn = vi.fn().mockResolvedValue('data');
    renderHook(() => useAsync(asyncFn, { immediate: true }));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(asyncFn).toHaveBeenCalled();
  });

  it('passes arguments to async function', async () => {
    const asyncFn = vi.fn().mockResolvedValue('data');
    const { result } = renderHook(() => useAsync(asyncFn));

    await act(async () => {
      await result.current.execute('arg1', 'arg2');
    });

    expect(asyncFn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('resets state', async () => {
    const asyncFn = vi.fn().mockResolvedValue('data');
    const { result } = renderHook(() => useAsync(asyncFn));

    await act(async () => {
      await result.current.execute();
    });
    expect(result.current.status).toBe('success');

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });
});

describe('usePolling', () => {
  it('does not poll when disabled', () => {
    const asyncFn = vi.fn().mockResolvedValue('data');
    const { result } = renderHook(() =>
      usePolling(asyncFn, { interval: 1000, enabled: false })
    );

    expect(result.current.isIdle).toBe(true);
    expect(asyncFn).not.toHaveBeenCalled();
  });

  it('can manually refresh when disabled', async () => {
    const asyncFn = vi.fn().mockResolvedValue('refreshed data');
    const { result } = renderHook(() =>
      usePolling(asyncFn, { interval: 10000, enabled: false })
    );

    await act(async () => {
      await result.current.refresh();
    });

    expect(asyncFn).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBe('refreshed data');
    expect(result.current.isSuccess).toBe(true);
  });

  it('handles refresh errors', async () => {
    const error = new Error('Refresh failed');
    const asyncFn = vi.fn().mockRejectedValue(error);
    const { result } = renderHook(() =>
      usePolling(asyncFn, { interval: 10000, enabled: false })
    );

    await act(async () => {
      try {
        await result.current.refresh();
      } catch {
        // Expected
      }
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(error);
  });

  it('provides start and stop functions', () => {
    const asyncFn = vi.fn().mockResolvedValue('data');
    const { result } = renderHook(() =>
      usePolling(asyncFn, { interval: 1000, enabled: false })
    );

    expect(typeof result.current.start).toBe('function');
    expect(typeof result.current.stop).toBe('function');
    expect(typeof result.current.refresh).toBe('function');
  });

  it('initializes with correct state', () => {
    const asyncFn = vi.fn().mockResolvedValue('data');
    const { result } = renderHook(() =>
      usePolling(asyncFn, { interval: 1000, enabled: false })
    );

    expect(result.current.status).toBe('idle');
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isIdle).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);
  });
});

describe('useAsyncWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('succeeds on first try', async () => {
    const asyncFn = vi.fn().mockResolvedValue('data');
    const { result } = renderHook(() =>
      useAsyncWithRetry(asyncFn, { retries: 3 })
    );

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.status).toBe('success');
    expect(result.current.data).toBe('data');
    expect(asyncFn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure', async () => {
    const asyncFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockResolvedValue('data');

    const { result } = renderHook(() =>
      useAsyncWithRetry(asyncFn, { retries: 3, retryDelay: 100, backoff: false })
    );

    await act(async () => {
      const promise = result.current.execute();
      await vi.advanceTimersByTimeAsync(300);
      await promise;
    });

    expect(result.current.status).toBe('success');
    expect(result.current.data).toBe('data');
    expect(asyncFn).toHaveBeenCalledTimes(3);
  });

  it('fails after max retries', async () => {
    vi.useRealTimers(); // Use real timers for this test

    const error = new Error('Persistent failure');
    const asyncFn = vi.fn().mockRejectedValue(error);

    const { result } = renderHook(() =>
      useAsyncWithRetry(asyncFn, { retries: 1, retryDelay: 10, backoff: false })
    );

    await act(async () => {
      try {
        await result.current.execute();
      } catch {
        // Expected
      }
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe(error);
    expect(asyncFn).toHaveBeenCalledTimes(2); // Initial + 1 retry

    vi.useFakeTimers(); // Restore for other tests
  });

  it('uses exponential backoff', async () => {
    const asyncFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockResolvedValue('data');

    const { result } = renderHook(() =>
      useAsyncWithRetry(asyncFn, { retries: 3, retryDelay: 100, backoff: true })
    );

    const executePromise = act(async () => {
      const promise = result.current.execute();
      // First retry after 100ms
      await vi.advanceTimersByTimeAsync(100);
      // Second retry after 200ms (100 * 2^1)
      await vi.advanceTimersByTimeAsync(200);
      await promise;
    });

    await executePromise;

    expect(result.current.status).toBe('success');
  });

  it('resets state', async () => {
    const asyncFn = vi.fn().mockResolvedValue('data');
    const { result } = renderHook(() => useAsyncWithRetry(asyncFn));

    await act(async () => {
      await result.current.execute();
    });
    expect(result.current.status).toBe('success');

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
