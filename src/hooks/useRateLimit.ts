import { useSyncExternalStore } from 'react'

interface RateLimitInfo {
  readonly remaining: number
  readonly limit: number
  readonly resetAt: number
}

type Listener = () => void

interface RateLimitStore {
  readonly subscribe: (listener: Listener) => () => void
  readonly getSnapshot: () => RateLimitInfo
  readonly update: (info: RateLimitInfo) => void
}

const DEFAULT_RATE_LIMIT: RateLimitInfo = {
  remaining: 5000,
  limit: 5000,
  resetAt: 0,
}

function createRateLimitStore(): RateLimitStore {
  let current: RateLimitInfo = DEFAULT_RATE_LIMIT
  let listeners: readonly Listener[] = []

  const notify = (): void => {
    listeners.forEach((l) => l())
  }

  return {
    subscribe(listener: Listener) {
      listeners = [...listeners, listener]
      return () => {
        listeners = listeners.filter((l) => l !== listener)
      }
    },
    getSnapshot() {
      return current
    },
    update(info: RateLimitInfo) {
      current = info
      notify()
    },
  }
}

const store = createRateLimitStore()

export function updateRateLimit(headers: Headers): void {
  const remaining = headers.get('x-ratelimit-remaining')
  const limit = headers.get('x-ratelimit-limit')
  const reset = headers.get('x-ratelimit-reset')

  if (remaining !== null && limit !== null && reset !== null) {
    const parsedRemaining = Number(remaining)
    const parsedLimit = Number(limit)
    const parsedReset = Number(reset)

    if (!Number.isNaN(parsedRemaining) && !Number.isNaN(parsedLimit) && !Number.isNaN(parsedReset)) {
      store.update({
        remaining: parsedRemaining,
        limit: parsedLimit,
        resetAt: parsedReset * 1000,
      })
    }
  }
}

export function getRateLimitRemaining(): number {
  return store.getSnapshot().remaining
}

export function useRateLimit(): RateLimitInfo {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => DEFAULT_RATE_LIMIT,
  )
}
