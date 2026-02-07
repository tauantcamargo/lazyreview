import { useState, useEffect, useCallback, useRef } from 'react';

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  status: AsyncStatus;
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  isIdle: boolean;
}

export interface UseAsyncOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  immediate?: boolean;
}

export interface UseAsyncResult<T, A extends unknown[]> extends AsyncState<T> {
  execute: (...args: A) => Promise<T>;
  reset: () => void;
}

export function useAsync<T, A extends unknown[] = []>(
  asyncFn: (...args: A) => Promise<T>,
  options: UseAsyncOptions<T> = {}
): UseAsyncResult<T, A> {
  const { onSuccess, onError, immediate = false } = options;
  const [status, setStatus] = useState<AsyncStatus>('idle');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  // Keep refs current
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onSuccess, onError]);

  // Track mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(
    async (...args: A): Promise<T> => {
      setStatus('loading');
      setError(null);

      try {
        const result = await asyncFn(...args);

        if (mountedRef.current) {
          setData(result);
          setStatus('success');
          onSuccessRef.current?.(result);
        }

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        if (mountedRef.current) {
          setError(error);
          setStatus('error');
          onErrorRef.current?.(error);
        }

        throw error;
      }
    },
    [asyncFn]
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setData(null);
    setError(null);
  }, []);

  // Execute immediately if requested
  useEffect(() => {
    if (immediate) {
      execute(...([] as unknown as A));
    }
  }, [immediate, execute]);

  return {
    status,
    data,
    error,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
    isError: status === 'error',
    isIdle: status === 'idle',
    execute,
    reset,
  };
}

export interface UsePollingOptions<T> {
  interval: number;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export interface UsePollingResult<T> extends AsyncState<T> {
  start: () => void;
  stop: () => void;
  refresh: () => Promise<T>;
}

export function usePolling<T>(
  asyncFn: () => Promise<T>,
  options: UsePollingOptions<T>
): UsePollingResult<T> {
  const { interval, enabled = true, onSuccess, onError } = options;
  const [status, setStatus] = useState<AsyncStatus>('idle');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isPolling, setIsPolling] = useState(enabled);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // Track mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchData = useCallback(async (): Promise<T> => {
    setStatus('loading');

    try {
      const result = await asyncFn();

      if (mountedRef.current) {
        setData(result);
        setStatus('success');
        setError(null);
        onSuccess?.(result);
      }

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      if (mountedRef.current) {
        setError(error);
        setStatus('error');
        onError?.(error);
      }

      throw error;
    }
  }, [asyncFn, onSuccess, onError]);

  const start = useCallback(() => {
    setIsPolling(true);
  }, []);

  const stop = useCallback(() => {
    setIsPolling(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const refresh = useCallback(async (): Promise<T> => {
    return fetchData();
  }, [fetchData]);

  // Handle polling
  useEffect(() => {
    if (!isPolling) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial fetch
    fetchData().catch(() => {
      // Errors are handled in fetchData
    });

    // Set up interval
    intervalRef.current = setInterval(() => {
      fetchData().catch(() => {
        // Errors are handled in fetchData
      });
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPolling, interval, fetchData]);

  return {
    status,
    data,
    error,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
    isError: status === 'error',
    isIdle: status === 'idle',
    start,
    stop,
    refresh,
  };
}

export interface UseRetryOptions {
  retries?: number;
  retryDelay?: number;
  backoff?: boolean;
}

export function useAsyncWithRetry<T, A extends unknown[] = []>(
  asyncFn: (...args: A) => Promise<T>,
  options: UseRetryOptions = {}
): UseAsyncResult<T, A> {
  const { retries = 3, retryDelay = 1000, backoff = true } = options;
  const [status, setStatus] = useState<AsyncStatus>('idle');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(
    async (...args: A): Promise<T> => {
      setStatus('loading');
      setError(null);

      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const result = await asyncFn(...args);

          if (mountedRef.current) {
            setData(result);
            setStatus('success');
          }

          return result;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));

          if (attempt < retries) {
            const delay = backoff ? retryDelay * Math.pow(2, attempt) : retryDelay;
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      if (mountedRef.current) {
        setError(lastError);
        setStatus('error');
      }

      throw lastError;
    },
    [asyncFn, retries, retryDelay, backoff]
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setData(null);
    setError(null);
  }, []);

  return {
    status,
    data,
    error,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
    isError: status === 'error',
    isIdle: status === 'idle',
    execute,
    reset,
  };
}
