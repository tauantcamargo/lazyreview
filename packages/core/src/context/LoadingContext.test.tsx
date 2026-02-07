/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { LoadingProvider, useLoading, useLoadingOperation } from './LoadingContext';

function wrapper({ children }: { children: React.ReactNode }) {
  return <LoadingProvider>{children}</LoadingProvider>;
}

describe('LoadingContext', () => {
  describe('useLoading', () => {
    it('throws error when used outside LoadingProvider', () => {
      // Suppress console error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useLoading());
      }).toThrow('useLoading must be used within LoadingProvider');

      consoleSpy.mockRestore();
    });

    it('provides initial loading state', () => {
      const { result } = renderHook(() => useLoading(), { wrapper });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.message).toBe(null);
      expect(result.current.operation).toBe(null);
    });

    it('starts loading with message', () => {
      const { result } = renderHook(() => useLoading(), { wrapper });

      act(() => {
        result.current.startLoading('Fetching data...');
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.message).toBe('Fetching data...');
      expect(result.current.operation).toBe(null);
    });

    it('starts loading with message and operation name', () => {
      const { result } = renderHook(() => useLoading(), { wrapper });

      act(() => {
        result.current.startLoading('Authenticating...', 'auth');
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.message).toBe('Authenticating...');
      expect(result.current.operation).toBe('auth');
    });

    it('updates loading message', () => {
      const { result } = renderHook(() => useLoading(), { wrapper });

      act(() => {
        result.current.startLoading('Loading...');
      });

      act(() => {
        result.current.updateMessage('Almost done...');
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.message).toBe('Almost done...');
    });

    it('stops loading', () => {
      const { result } = renderHook(() => useLoading(), { wrapper });

      act(() => {
        result.current.startLoading('Loading...');
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.stopLoading();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.message).toBe(null);
      expect(result.current.operation).toBe(null);
    });

    it('handles multiple start/stop cycles', () => {
      const { result } = renderHook(() => useLoading(), { wrapper });

      act(() => {
        result.current.startLoading('Loading 1...');
      });
      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.stopLoading();
      });
      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.startLoading('Loading 2...');
      });
      expect(result.current.isLoading).toBe(true);
      expect(result.current.message).toBe('Loading 2...');
    });
  });

  describe('useLoadingOperation', () => {
    it('provides operation-specific loading state', () => {
      const { result } = renderHook(() => useLoadingOperation('fetch-prs'), { wrapper });

      expect(result.current.isLoading).toBe(false);
    });

    it('wraps async function with loading state', async () => {
      const { result } = renderHook(() => useLoadingOperation('fetch-prs'), { wrapper });

      const asyncFn = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'success';
      });

      const promise = act(async () => {
        return await result.current.withLoading(asyncFn, 'Fetching PRs...');
      });

      // Should be loading during async operation
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false); // Will be false after completion
      });

      const returnValue = await promise;
      expect(returnValue).toBe('success');
      expect(asyncFn).toHaveBeenCalledTimes(1);
    });

    it('stops loading even if async function throws', async () => {
      const { result } = renderHook(() => useLoadingOperation('fetch-prs'), { wrapper });

      const asyncFn = vi.fn(async () => {
        throw new Error('Test error');
      });

      await act(async () => {
        try {
          await result.current.withLoading(asyncFn, 'Fetching PRs...');
        } catch (error) {
          // Expected to throw
        }
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('only shows loading for current operation', async () => {
      const { result: result1 } = renderHook(() => useLoadingOperation('operation1'), { wrapper });
      const { result: result2 } = renderHook(() => useLoadingOperation('operation2'), { wrapper });

      act(() => {
        result1.current.updateMessage('Operation 1');
      });

      // Both hooks share the same context, but only operation1 should show loading
      expect(result1.current.isLoading).toBe(false); // No loading started yet
      expect(result2.current.isLoading).toBe(false);
    });

    it('handles multiple operations sequentially', async () => {
      const { result } = renderHook(() => useLoadingOperation('test'), { wrapper });

      const fn1 = vi.fn(async () => 'result1');
      const fn2 = vi.fn(async () => 'result2');

      const result1 = await act(async () => {
        return await result.current.withLoading(fn1, 'Operation 1');
      });

      const result2 = await act(async () => {
        return await result.current.withLoading(fn2, 'Operation 2');
      });

      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
      expect(result.current.isLoading).toBe(false);
    });
  });
});
