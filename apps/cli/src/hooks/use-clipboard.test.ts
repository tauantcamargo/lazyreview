import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClipboard } from './use-clipboard';

describe('useClipboard', () => {
  const mockCopyFn = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockCopyFn.mockResolvedValue(undefined);
  });

  it('initializes with copied false and no error', () => {
    const { result } = renderHook(() => useClipboard({ copyFn: mockCopyFn }));
    expect(result.current.copied).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets copied to true after successful copy', async () => {
    const { result } = renderHook(() => useClipboard({ copyFn: mockCopyFn }));

    await act(async () => {
      await result.current.copy('test text');
    });

    expect(mockCopyFn).toHaveBeenCalledWith('test text');
    expect(result.current.copied).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('sets error on copy failure', async () => {
    mockCopyFn.mockRejectedValue(new Error('Clipboard not available'));

    const { result } = renderHook(() => useClipboard({ copyFn: mockCopyFn }));

    await act(async () => {
      await result.current.copy('test text');
    });

    expect(result.current.copied).toBe(false);
    expect(result.current.error).toBe('Clipboard not available');
  });

  it('handles non-Error rejection', async () => {
    mockCopyFn.mockRejectedValue('string error');

    const { result } = renderHook(() => useClipboard({ copyFn: mockCopyFn }));

    await act(async () => {
      await result.current.copy('test text');
    });

    expect(result.current.copied).toBe(false);
    expect(result.current.error).toBe('Failed to copy to clipboard');
  });

  it('resets state', async () => {
    const { result } = renderHook(() => useClipboard({ copyFn: mockCopyFn }));

    await act(async () => {
      await result.current.copy('test text');
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      result.current.reset();
    });

    expect(result.current.copied).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('resets after error', async () => {
    mockCopyFn.mockRejectedValue(new Error('Error'));

    const { result } = renderHook(() => useClipboard({ copyFn: mockCopyFn }));

    await act(async () => {
      await result.current.copy('test text');
    });
    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.copied).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('has copy function', () => {
    const { result } = renderHook(() => useClipboard({ copyFn: mockCopyFn }));
    expect(typeof result.current.copy).toBe('function');
  });

  it('has reset function', () => {
    const { result } = renderHook(() => useClipboard({ copyFn: mockCopyFn }));
    expect(typeof result.current.reset).toBe('function');
  });

  it('auto-resets copied after delay', async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useClipboard({ copyFn: mockCopyFn, resetDelay: 1000 })
    );

    await act(async () => {
      await result.current.copy('test text');
    });

    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.copied).toBe(false);

    vi.useRealTimers();
  });

  it('works without options (uses defaults)', () => {
    // This test just verifies the hook can be called without options
    // We don't actually copy since that would require system clipboard
    const { result } = renderHook(() => useClipboard());
    expect(result.current.copied).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.copy).toBe('function');
    expect(typeof result.current.reset).toBe('function');
  });
});
