import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { useStateStore } from '../services/state/StateProvider'
import type { StateStore } from '../services/state/types'
import {
  deserializeSessions,
  serializeSessions,
  type ReviewSession,
} from '../utils/review-stats'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSIONS_KV_KEY = 'review_sessions'
const TIMER_INTERVAL_MS = 1000

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void

interface ReviewSessionState {
  readonly elapsedSeconds: number
  readonly isPaused: boolean
}

export interface ReviewSessionStore {
  readonly subscribe: (listener: Listener) => () => void
  readonly getSnapshot: () => ReviewSessionState
  readonly start: () => void
  readonly stop: () => void
  readonly togglePause: () => void
  readonly getElapsedSeconds: () => number
  readonly isPaused: () => boolean
  readonly destroy: () => void
}

// ---------------------------------------------------------------------------
// Store factory
// ---------------------------------------------------------------------------

export function createReviewSessionStore(): ReviewSessionStore {
  let listeners: readonly Listener[] = []
  let state: ReviewSessionState = { elapsedSeconds: 0, isPaused: false }
  let intervalId: ReturnType<typeof setInterval> | null = null
  let running = false

  const notify = (): void => {
    listeners.forEach((l) => l())
  }

  const tick = (): void => {
    if (!state.isPaused) {
      state = { ...state, elapsedSeconds: state.elapsedSeconds + 1 }
      notify()
    }
  }

  return {
    subscribe(listener: Listener) {
      listeners = [...listeners, listener]
      return () => {
        listeners = listeners.filter((l) => l !== listener)
      }
    },

    getSnapshot() {
      return state
    },

    start() {
      if (running) return
      running = true
      state = { elapsedSeconds: 0, isPaused: false }
      intervalId = setInterval(tick, TIMER_INTERVAL_MS)
      notify()
    },

    stop() {
      if (!running) return
      running = false
      if (intervalId !== null) {
        clearInterval(intervalId)
        intervalId = null
      }
    },

    togglePause() {
      state = { ...state, isPaused: !state.isPaused }
      notify()
    },

    getElapsedSeconds() {
      return state.elapsedSeconds
    },

    isPaused() {
      return state.isPaused
    },

    destroy() {
      running = false
      if (intervalId !== null) {
        clearInterval(intervalId)
        intervalId = null
      }
      state = { elapsedSeconds: 0, isPaused: false }
      listeners = []
    },
  }
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

/**
 * Load all stored review sessions from the StateStore KV.
 */
export function loadSessions(stateStore: StateStore): readonly ReviewSession[] {
  const raw = stateStore.getKV(SESSIONS_KV_KEY)
  if (!raw) return []
  return deserializeSessions(raw)
}

/**
 * Persist a new review session to the StateStore KV.
 * Appends to existing sessions without mutation.
 */
export function persistSession(
  stateStore: StateStore,
  session: ReviewSession,
): void {
  const existing = loadSessions(stateStore)
  const updated = [...existing, session]
  stateStore.setKV(SESSIONS_KV_KEY, serializeSessions(updated))
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages a review session timer for a PR detail view.
 *
 * - Auto-starts on mount
 * - Auto-stops and persists on unmount
 * - Returns elapsed time, pause state, and toggle function
 *
 * @param prKey - The PR identifier (e.g. "owner/repo#123")
 * @param filesReviewedRef - Optional ref providing current viewed files count
 */
export function useReviewSession(
  prKey: string,
  filesReviewedRef?: React.RefObject<number>,
): {
  readonly elapsedSeconds: number
  readonly isPaused: boolean
  readonly togglePause: () => void
} {
  const stateStore = useStateStore()
  const storeRef = useRef<ReviewSessionStore | null>(null)
  const prKeyRef = useRef(prKey)

  // Keep prKey ref up to date
  prKeyRef.current = prKey

  // Create store lazily
  if (storeRef.current === null) {
    storeRef.current = createReviewSessionStore()
  }

  const store = storeRef.current

  // Start on mount, stop and persist on unmount
  useEffect(() => {
    store.start()

    return () => {
      const elapsed = store.getElapsedSeconds()
      store.stop()

      // Only persist sessions longer than 5 seconds
      if (elapsed > 5 && stateStore) {
        const session: ReviewSession = {
          prKey: prKeyRef.current,
          durationMs: elapsed * 1000,
          timestamp: new Date().toISOString(),
          filesReviewed: filesReviewedRef?.current ?? 0,
        }
        persistSession(stateStore, session)
      }

      store.destroy()
    }
    // We intentionally only run on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => ({ elapsedSeconds: 0, isPaused: false }),
  )

  const togglePause = useCallback(() => {
    store.togglePause()
  }, [store])

  return {
    elapsedSeconds: state.elapsedSeconds,
    isPaused: state.isPaused,
    togglePause,
  } as const
}

/**
 * Hook to access stored review sessions for the stats display.
 * Returns all persisted sessions from the StateStore KV.
 */
export function useReviewSessions(): readonly ReviewSession[] {
  const stateStore = useStateStore()
  if (!stateStore) return []
  return loadSessions(stateStore)
}
