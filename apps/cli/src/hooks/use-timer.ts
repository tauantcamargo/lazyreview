import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseTimerOptions {
  interval: number;
  autoStart?: boolean;
  onTick?: () => void;
}

export interface UseTimerResult {
  isRunning: boolean;
  elapsed: number;
  start: () => void;
  stop: () => void;
  reset: () => void;
  restart: () => void;
}

export function useTimer(options: UseTimerOptions): UseTimerResult {
  const { interval, autoStart = false, onTick } = options;
  const [isRunning, setIsRunning] = useState(autoStart);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTickRef = useRef(onTick);

  // Keep onTick ref current
  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  const stop = useCallback(() => {
    setIsRunning(false);
    clearTimer();
  }, [clearTimer]);

  const reset = useCallback(() => {
    setElapsed(0);
  }, []);

  const restart = useCallback(() => {
    setElapsed(0);
    setIsRunning(true);
  }, []);

  useEffect(() => {
    if (!isRunning) {
      clearTimer();
      return;
    }

    intervalRef.current = setInterval(() => {
      setElapsed((prev) => prev + interval);
      onTickRef.current?.();
    }, interval);

    return () => {
      clearTimer();
    };
  }, [isRunning, interval, clearTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return {
    isRunning,
    elapsed,
    start,
    stop,
    reset,
    restart,
  };
}

export interface UseIntervalOptions {
  callback: () => void;
  delay: number | null;
  immediate?: boolean;
}

export function useInterval(options: UseIntervalOptions): void {
  const { callback, delay, immediate = false } = options;
  const savedCallback = useRef(callback);
  const hasRun = useRef(false);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Run immediately if requested
  useEffect(() => {
    if (immediate && !hasRun.current && delay !== null) {
      hasRun.current = true;
      savedCallback.current();
    }
  }, [immediate, delay]);

  // Set up the interval
  useEffect(() => {
    if (delay === null) {
      return;
    }

    const id = setInterval(() => {
      savedCallback.current();
    }, delay);

    return () => {
      clearInterval(id);
    };
  }, [delay]);
}
