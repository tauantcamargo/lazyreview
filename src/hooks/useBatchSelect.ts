import { useCallback, useSyncExternalStore } from 'react'

export interface BatchSelectState {
  readonly isMultiSelect: boolean
  readonly selectedIndices: readonly number[]
}

type Listener = () => void

export interface BatchSelectStore {
  readonly subscribe: (listener: Listener) => () => void
  readonly getSnapshot: () => BatchSelectState
  readonly enterMultiSelect: () => void
  readonly exitMultiSelect: () => void
  readonly toggle: (index: number) => void
  readonly selectAll: (itemCount: number) => void
  readonly clearAll: () => void
}

const INITIAL_STATE: BatchSelectState = {
  isMultiSelect: false,
  selectedIndices: [],
}

export function createBatchSelectStore(): BatchSelectStore {
  let state: BatchSelectState = INITIAL_STATE
  let listeners: readonly Listener[] = []

  const notify = (): void => {
    listeners.forEach((l) => l())
  }

  const setState = (next: BatchSelectState): void => {
    state = next
    notify()
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

    enterMultiSelect() {
      if (state.isMultiSelect) return
      setState({ ...state, isMultiSelect: true })
    },

    exitMultiSelect() {
      if (!state.isMultiSelect) return
      setState(INITIAL_STATE)
    },

    toggle(index: number) {
      if (!state.isMultiSelect) return
      const exists = state.selectedIndices.includes(index)
      const selectedIndices = exists
        ? state.selectedIndices.filter((i) => i !== index)
        : [...state.selectedIndices, index]
      setState({ ...state, selectedIndices })
    },

    selectAll(itemCount: number) {
      if (!state.isMultiSelect) return
      const selectedIndices = Array.from({ length: itemCount }, (_, i) => i)
      setState({ ...state, selectedIndices })
    },

    clearAll() {
      if (!state.isMultiSelect) return
      setState({ ...state, selectedIndices: [] })
    },
  }
}

// Singleton store for the application
const store = createBatchSelectStore()

export interface UseBatchSelectResult {
  readonly isMultiSelect: boolean
  readonly selectedIndices: readonly number[]
  readonly enterMultiSelect: () => void
  readonly exitMultiSelect: () => void
  readonly toggle: (index: number) => void
  readonly selectAll: (itemCount: number) => void
  readonly clearAll: () => void
}

export function useBatchSelect(): UseBatchSelectResult {
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => INITIAL_STATE,
  )

  const enterMultiSelect = useCallback(() => {
    store.enterMultiSelect()
  }, [])

  const exitMultiSelect = useCallback(() => {
    store.exitMultiSelect()
  }, [])

  const toggle = useCallback((index: number) => {
    store.toggle(index)
  }, [])

  const selectAll = useCallback((itemCount: number) => {
    store.selectAll(itemCount)
  }, [])

  const clearAll = useCallback(() => {
    store.clearAll()
  }, [])

  return {
    isMultiSelect: state.isMultiSelect,
    selectedIndices: state.selectedIndices,
    enterMultiSelect,
    exitMultiSelect,
    toggle,
    selectAll,
    clearAll,
  }
}

// Re-export store for external reset (e.g., screen navigation)
export { store as batchSelectStore }
