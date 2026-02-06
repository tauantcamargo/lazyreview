import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseDebounceOptions {
  delay: number;
  leading?: boolean;
}

export function useDebounce<T>(
  value: T,
  delay: number,
  options: { leading?: boolean } = {}
): T {
  const { leading = false } = options;
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // If leading, update immediately on first change
    if (leading && isFirstRender.current) {
      isFirstRender.current = false;
      setDebouncedValue(value);
      return;
    }

    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay, leading]);

  return debouncedValue;
}

export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number,
  deps: unknown[] = []
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  // Keep callback ref current
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback, ...deps]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );
}

export interface UseThrottleOptions {
  leading?: boolean;
  trailing?: boolean;
}

export function useThrottle<T>(
  value: T,
  limit: number,
  options: UseThrottleOptions = {}
): T {
  const { leading = true, trailing = true } = options;
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastRan = useRef<number>(Date.now());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const now = Date.now();

    if (leading && now - lastRan.current >= limit) {
      setThrottledValue(value);
      lastRan.current = now;
    } else if (trailing) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }, limit - (now - lastRan.current));
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, limit, leading, trailing]);

  return throttledValue;
}

export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  limit: number,
  deps: unknown[] = []
): (...args: Parameters<T>) => void {
  const lastRan = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  // Keep callback ref current
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback, ...deps]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();

      if (now - lastRan.current >= limit) {
        callbackRef.current(...args);
        lastRan.current = now;
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          callbackRef.current(...args);
          lastRan.current = Date.now();
        }, limit - (now - lastRan.current));
      }
    },
    [limit]
  );
}
