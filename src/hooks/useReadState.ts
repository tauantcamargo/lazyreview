import { useCallback, useSyncExternalStore } from 'react'
import { useStateStore } from '../services/state/StateProvider'
import type { StateStore } from '../services/state/types'

// ---------------------------------------------------------------------------
// Public types (preserved for backward compatibility)
// ---------------------------------------------------------------------------

export interface ReadEntry {
  readonly lastSeenAt: string
  readonly prUpdatedAt: string
}

export type ReadStateData = Readonly<Record<string, ReadEntry>>

type Listener = () => void

export interface ReadStateStore {
  readonly subscribe: (listener: Listener) => () => void
  readonly getSnapshot: () => ReadStateData
  readonly markAsRead: (htmlUrl: string, prUpdatedAt: string) => void
  readonly isUnread: (htmlUrl: string, prUpdatedAt: string) => boolean
}

// ---------------------------------------------------------------------------
// Prune helper (kept for backward compat / testing)
// ---------------------------------------------------------------------------

const PRUNE_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export function pruneOldEntries(data: ReadStateData): ReadStateData {
  const now = Date.now()
  const result: Record<string, ReadEntry> = {}

  for (const [key, entry] of Object.entries(data)) {
    const seenAt = new Date(entry.lastSeenAt).getTime()
    if (now - seenAt < PRUNE_AGE_MS) {
      result[key] = entry
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Store backed by StateStore (SQLite)
// ---------------------------------------------------------------------------

function createSqliteReadStateStore(stateStore: StateStore): ReadStateStore {
  let listeners: readonly Listener[] = []
  let snapshot: ReadStateData = {}

  const notify = (): void => {
    listeners.forEach((l) => l())
  }

  function refreshKey(htmlUrl: string): void {
    const state = stateStore.getReadState(htmlUrl)
    if (state) {
      snapshot = {
        ...snapshot,
        [htmlUrl]: {
          lastSeenAt: state.lastSeenAt,
          prUpdatedAt: state.prUpdatedAt,
        },
      }
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
      return snapshot
    },

    markAsRead(htmlUrl: string, prUpdatedAt: string) {
      stateStore.setReadState(htmlUrl, prUpdatedAt)
      refreshKey(htmlUrl)
      notify()
    },

    isUnread(htmlUrl: string, prUpdatedAt: string): boolean {
      const persisted = stateStore.getReadState(htmlUrl)
      if (!persisted) return true
      return (
        new Date(prUpdatedAt).getTime() >
        new Date(persisted.prUpdatedAt).getTime()
      )
    },
  }
}

// ---------------------------------------------------------------------------
// In-memory fallback store (no persistence)
// ---------------------------------------------------------------------------

export function createReadStateStore(): ReadStateStore {
  let data: ReadStateData = {}
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
      return data
    },

    markAsRead(htmlUrl: string, prUpdatedAt: string) {
      const now = new Date().toISOString()
      data = {
        ...data,
        [htmlUrl]: { lastSeenAt: now, prUpdatedAt },
      }
      notify()
    },

    isUnread(htmlUrl: string, prUpdatedAt: string): boolean {
      const entry = data[htmlUrl]
      if (!entry) return true
      return (
        new Date(prUpdatedAt).getTime() >
        new Date(entry.prUpdatedAt).getTime()
      )
    },
  }
}

// ---------------------------------------------------------------------------
// Singleton management
// ---------------------------------------------------------------------------

let singletonStore: ReadStateStore | null = null
let singletonStateStore: StateStore | null = null

function getOrCreateStore(stateStore: StateStore | null): ReadStateStore {
  if (stateStore && stateStore !== singletonStateStore) {
    singletonStateStore = stateStore
    singletonStore = createSqliteReadStateStore(stateStore)
    return singletonStore
  }
  if (singletonStore) return singletonStore
  singletonStore = createReadStateStore()
  return singletonStore
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useReadState(): {
  readonly readState: ReadStateData
  readonly markAsRead: (htmlUrl: string, prUpdatedAt: string) => void
  readonly isUnread: (htmlUrl: string, prUpdatedAt: string) => boolean
} {
  const stateStore = useStateStore()
  const store = getOrCreateStore(stateStore)

  const readState = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => ({}) as ReadStateData,
  )

  const markAsRead = useCallback(
    (htmlUrl: string, prUpdatedAt: string) => {
      store.markAsRead(htmlUrl, prUpdatedAt)
    },
    [store],
  )

  const isUnread = useCallback(
    (htmlUrl: string, prUpdatedAt: string) => {
      return store.isUnread(htmlUrl, prUpdatedAt)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [readState, store],
  )

  return { readState, markAsRead, isUnread } as const
}
