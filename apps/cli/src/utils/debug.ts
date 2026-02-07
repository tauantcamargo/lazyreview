/**
 * Debug Logging Utility
 *
 * Provides verbose logging when debug mode is enabled.
 */

let debugEnabled = false;

export function enableDebug(): void {
  debugEnabled = true;
}

export function isDebugEnabled(): boolean {
  return debugEnabled;
}

export function debug(message: string, ...args: unknown[]): void {
  if (debugEnabled) {
    const timestamp = new Date().toISOString();
    console.error(`[DEBUG ${timestamp}]`, message, ...args);
  }
}

export function debugError(message: string, error: unknown): void {
  if (debugEnabled) {
    const timestamp = new Date().toISOString();
    console.error(`[DEBUG ${timestamp}] ERROR:`, message);
    if (error instanceof Error) {
      console.error(`  Message: ${error.message}`);
      if (error.stack) {
        console.error(`  Stack:\n${error.stack}`);
      }
    } else {
      console.error(`  Value:`, error);
    }
  }
}

export function debugTiming<T>(label: string, fn: () => T): T {
  if (!debugEnabled) {
    return fn();
  }

  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  debug(`${label} completed in ${duration.toFixed(2)}ms`);
  return result;
}

export async function debugTimingAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!debugEnabled) {
    return fn();
  }

  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  debug(`${label} completed in ${duration.toFixed(2)}ms`);
  return result;
}
