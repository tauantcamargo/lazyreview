import { Effect } from 'effect'

interface CoalescerOptions {
  readonly windowMs?: number
}

interface CacheEntry<A> {
  readonly promise: Promise<A>
  readonly expiresAt: number
  readonly cleanupTimer: ReturnType<typeof setTimeout> | null
}

export interface Coalescer<A> {
  readonly coalesce: <E>(
    key: string,
    effect: Effect.Effect<A, E>,
  ) => Effect.Effect<A, E>
  readonly size: () => number
}

const DEFAULT_WINDOW_MS = 100

// In-flight entries use a far-future sentinel so concurrent callers
// always share the same pending promise.
const IN_FLIGHT_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Creates a request coalescer that deduplicates concurrent Effect executions
 * sharing the same key. Concurrent callers receive the same result (success
 * or failure). After the configurable window expires the entry is removed
 * so a subsequent call triggers a fresh execution.
 */
export function createCoalescer<A>(
  options?: CoalescerOptions,
): Coalescer<A> {
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS
  const cache = new Map<string, CacheEntry<A>>()

  const coalesce = <E>(
    key: string,
    effect: Effect.Effect<A, E>,
  ): Effect.Effect<A, E> => {
    return Effect.suspend(() => {
      const now = Date.now()
      const existing = cache.get(key)

      // Reuse a cached entry that has not expired
      if (existing && existing.expiresAt > now) {
        return Effect.promise(() => existing.promise) as Effect.Effect<A, E>
      }

      // Clean up any expired entry still in the map
      if (existing) {
        if (existing.cleanupTimer !== null) {
          clearTimeout(existing.cleanupTimer)
        }
        cache.delete(key)
      }

      // Execute the effect eagerly so all concurrent callers share the
      // same in-flight promise. Errors are re-thrown so every caller
      // receives the same rejection.
      const promise = Effect.runPromise(
        effect as Effect.Effect<A, never>,
      ).catch((error: unknown) => {
        throw error
      })

      // Store with a far-future expiry while the promise is in-flight
      cache.set(key, {
        promise,
        expiresAt: now + IN_FLIGHT_TTL_MS,
        cleanupTimer: null,
      })

      // Once settled, replace the entry with a real expiry and cleanup timer
      const settle = (): void => {
        const settledAt = Date.now()
        const timer = setTimeout(() => {
          cache.delete(key)
        }, windowMs)

        cache.set(key, {
          promise,
          expiresAt: settledAt + windowMs,
          cleanupTimer: timer,
        })
      }

      promise.then(settle, settle)

      return Effect.promise(() => promise) as Effect.Effect<A, E>
    })
  }

  const size = (): number => cache.size

  return { coalesce, size }
}
