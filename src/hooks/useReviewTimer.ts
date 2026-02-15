import { useSyncExternalStore } from 'react'

// ---------------------------------------------------------------------------
// Global store for review timer display in StatusBar.
// PRDetailScreen sets the timer value; StatusBar reads it.
// ---------------------------------------------------------------------------

type Listener = () => void

interface ReviewTimerState {
  /** Current elapsed seconds (0 when not in PR detail) */
  readonly elapsedSeconds: number
  /** Whether the timer is currently active (in PR detail screen) */
  readonly isActive: boolean
}

const EMPTY_STATE: ReviewTimerState = { elapsedSeconds: 0, isActive: false }

interface ReviewTimerStore {
  readonly subscribe: (listener: Listener) => () => void
  readonly getSnapshot: () => ReviewTimerState
  readonly setTimer: (elapsedSeconds: number) => void
  readonly clearTimer: () => void
}

function createReviewTimerStore(): ReviewTimerStore {
  let state: ReviewTimerState = EMPTY_STATE
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
      return state
    },

    setTimer(elapsedSeconds: number) {
      state = { elapsedSeconds, isActive: true }
      notify()
    },

    clearTimer() {
      if (!state.isActive && state.elapsedSeconds === 0) return
      state = EMPTY_STATE
      notify()
    },
  }
}

export const reviewTimerStore = createReviewTimerStore()

/**
 * Hook to read the current review timer state in StatusBar.
 * Returns the elapsed seconds and whether the timer is active.
 */
export function useReviewTimer(): ReviewTimerState {
  return useSyncExternalStore(
    reviewTimerStore.subscribe,
    reviewTimerStore.getSnapshot,
    () => EMPTY_STATE,
  )
}
