import { useCallback, useSyncExternalStore } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommitRange {
  readonly startSha: string
  readonly endSha: string
  readonly label: string
  readonly startIndex: number
  readonly endIndex: number
}

interface CommitRangeState {
  readonly range: CommitRange | null
  readonly isSelecting: boolean
  readonly startIndex: number | null
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function formatRangeLabel(startSha: string, endSha: string): string {
  return `${startSha.slice(0, 7)}..${endSha.slice(0, 7)}`
}

export function computeRangeIndices(
  a: number,
  b: number,
): { readonly startIndex: number; readonly endIndex: number } {
  return {
    startIndex: Math.min(a, b),
    endIndex: Math.max(a, b),
  }
}

// ---------------------------------------------------------------------------
// Store (external store pattern for React 19 useSyncExternalStore)
// ---------------------------------------------------------------------------

export interface CommitRangeStore {
  readonly getSnapshot: () => CommitRangeState
  readonly subscribe: (listener: () => void) => () => void
  readonly startSelection: (index: number, sha: string) => void
  readonly endSelection: (index: number, sha: string) => void
  readonly clearRange: () => void
  readonly isInRange: (index: number) => boolean
}

const INITIAL_STATE: CommitRangeState = {
  range: null,
  isSelecting: false,
  startIndex: null,
}

export function createCommitRangeStore(): CommitRangeStore {
  let state: CommitRangeState = { ...INITIAL_STATE }
  let startSha: string | null = null
  const listeners = new Set<() => void>()

  function notify(): void {
    for (const listener of listeners) {
      listener()
    }
  }

  return {
    getSnapshot: () => state,

    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    startSelection: (index: number, sha: string) => {
      startSha = sha
      state = {
        range: null,
        isSelecting: true,
        startIndex: index,
      }
      notify()
    },

    endSelection: (index: number, sha: string) => {
      if (!state.isSelecting || state.startIndex === null || startSha === null) {
        return
      }

      const { startIndex, endIndex } = computeRangeIndices(state.startIndex, index)

      // Map SHAs to normalized order
      const normalizedStartSha = state.startIndex <= index ? startSha : sha
      const normalizedEndSha = state.startIndex <= index ? sha : startSha

      state = {
        range: {
          startSha: normalizedStartSha,
          endSha: normalizedEndSha,
          label: formatRangeLabel(normalizedStartSha, normalizedEndSha),
          startIndex,
          endIndex,
        },
        isSelecting: false,
        startIndex: null,
      }
      startSha = null
      notify()
    },

    clearRange: () => {
      startSha = null
      state = { ...INITIAL_STATE }
      notify()
    },

    isInRange: (index: number): boolean => {
      if (state.range) {
        return index >= state.range.startIndex && index <= state.range.endIndex
      }
      if (state.isSelecting && state.startIndex !== null) {
        return index === state.startIndex
      }
      return false
    },
  }
}

// ---------------------------------------------------------------------------
// Singleton store instance for the app
// ---------------------------------------------------------------------------

let globalStore: CommitRangeStore | null = null

function getGlobalStore(): CommitRangeStore {
  if (!globalStore) {
    globalStore = createCommitRangeStore()
  }
  return globalStore
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseCommitRangeResult {
  readonly range: CommitRange | null
  readonly isSelecting: boolean
  readonly startIndex: number | null
  readonly startSelection: (index: number, sha: string) => void
  readonly endSelection: (index: number, sha: string) => void
  readonly clearRange: () => void
  readonly isInRange: (index: number) => boolean
}

export function useCommitRange(): UseCommitRangeResult {
  const store = getGlobalStore()

  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  )

  const startSelection = useCallback(
    (index: number, sha: string) => store.startSelection(index, sha),
    [store],
  )

  const endSelection = useCallback(
    (index: number, sha: string) => store.endSelection(index, sha),
    [store],
  )

  const clearRange = useCallback(() => store.clearRange(), [store])

  const isInRange = useCallback(
    (index: number) => store.isInRange(index),
    [store],
  )

  return {
    range: state.range,
    isSelecting: state.isSelecting,
    startIndex: state.startIndex,
    startSelection,
    endSelection,
    clearRange,
    isInRange,
  }
}
