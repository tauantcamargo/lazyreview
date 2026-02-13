import { useSyncExternalStore } from 'react'

type Listener = () => void

interface TokenExpiredStore {
  readonly getSnapshot: () => boolean
  readonly subscribe: (listener: Listener) => () => void
  readonly markExpired: () => void
  readonly reset: () => void
}

function createTokenExpiredStore(): TokenExpiredStore {
  let expired = false
  let listeners: readonly Listener[] = []

  const notify = (): void => {
    listeners.forEach((l) => l())
  }

  return {
    getSnapshot() {
      return expired
    },
    subscribe(listener: Listener) {
      listeners = [...listeners, listener]
      return () => {
        listeners = listeners.filter((l) => l !== listener)
      }
    },
    markExpired() {
      if (expired) return // prevent duplicate triggers
      expired = true
      notify()
    },
    reset() {
      expired = false
      notify()
    },
  }
}

const store = createTokenExpiredStore()

/**
 * Call from fetchGitHub when a 401 response is received.
 * This sets a global flag that triggers the token modal.
 */
export function notifyTokenExpired(): void {
  store.markExpired()
}

/**
 * Call after successful re-authentication to clear the expired flag.
 */
export function clearTokenExpired(): void {
  store.reset()
}

/**
 * Get the current expired state (for testing).
 */
export function isTokenExpiredSnapshot(): boolean {
  return store.getSnapshot()
}

/**
 * React hook to observe token expiration state.
 */
export function useTokenExpired(): {
  readonly isTokenExpired: boolean
} {
  const isTokenExpired = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => false,
  )

  return { isTokenExpired }
}
