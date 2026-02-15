import { useCallback, useSyncExternalStore } from 'react'
import { useStateStore } from '../services/state/StateProvider'
import type { StateStore } from '../services/state/types'

// ---------------------------------------------------------------------------
// Public types (preserved for backward compatibility)
// ---------------------------------------------------------------------------

export interface ViewedEntry {
  readonly viewedFiles: readonly string[]
  readonly lastUpdated: string
}

export type ViewedFilesData = Readonly<Record<string, ViewedEntry>>

type Listener = () => void

export interface ViewedFilesStore {
  readonly subscribe: (listener: Listener) => () => void
  readonly getSnapshot: () => ViewedFilesData
  readonly markViewed: (prUrl: string, filePath: string) => void
  readonly markUnviewed: (prUrl: string, filePath: string) => void
  readonly toggleViewed: (prUrl: string, filePath: string) => void
  readonly isViewed: (prUrl: string, filePath: string) => boolean
  readonly getViewedCount: (prUrl: string) => number
}

// ---------------------------------------------------------------------------
// Prune helper (kept for backward compat / testing)
// ---------------------------------------------------------------------------

const PRUNE_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export function pruneOldEntries(data: ViewedFilesData): ViewedFilesData {
  const now = Date.now()
  const result: Record<string, ViewedEntry> = {}

  for (const [key, entry] of Object.entries(data)) {
    const updatedAt = new Date(entry.lastUpdated).getTime()
    if (now - updatedAt < PRUNE_AGE_MS) {
      result[key] = entry
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Store backed by StateStore (SQLite)
// ---------------------------------------------------------------------------

export function createSqliteViewedFilesStore(
  stateStore: StateStore,
): ViewedFilesStore {
  let listeners: readonly Listener[] = []
  let snapshot: ViewedFilesData = {}

  function rebuildSnapshotForKey(prUrl: string): void {
    const files = stateStore.getViewedFiles(prUrl)
    if (files.length === 0) {
      const { [prUrl]: _, ...rest } = snapshot
      snapshot = rest
    } else {
      snapshot = {
        ...snapshot,
        [prUrl]: {
          viewedFiles: files.map((f) => f.filePath),
          lastUpdated:
            files[files.length - 1]?.viewedAt ?? new Date().toISOString(),
        },
      }
    }
  }

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
      return snapshot
    },

    markViewed(prUrl: string, filePath: string) {
      const existing = snapshot[prUrl]
      if (existing?.viewedFiles.includes(filePath)) return

      stateStore.setViewedFile(prUrl, filePath)
      rebuildSnapshotForKey(prUrl)
      notify()
    },

    markUnviewed(prUrl: string, filePath: string) {
      const existing = snapshot[prUrl]
      if (!existing) return

      stateStore.removeViewedFile(prUrl, filePath)
      rebuildSnapshotForKey(prUrl)
      notify()
    },

    toggleViewed(prUrl: string, filePath: string) {
      const existing = snapshot[prUrl]
      const viewedFiles = existing?.viewedFiles ?? []
      if (viewedFiles.includes(filePath)) {
        stateStore.removeViewedFile(prUrl, filePath)
      } else {
        stateStore.setViewedFile(prUrl, filePath)
      }
      rebuildSnapshotForKey(prUrl)
      notify()
    },

    isViewed(prUrl: string, filePath: string): boolean {
      const entry = snapshot[prUrl]
      if (!entry) return false
      return entry.viewedFiles.includes(filePath)
    },

    getViewedCount(prUrl: string): number {
      const entry = snapshot[prUrl]
      if (!entry) return 0
      return entry.viewedFiles.length
    },
  }
}

// ---------------------------------------------------------------------------
// In-memory fallback store (no persistence)
// ---------------------------------------------------------------------------

export function createViewedFilesStore(): ViewedFilesStore {
  let data: ViewedFilesData = {}
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

    markViewed(prUrl: string, filePath: string) {
      const existing = data[prUrl]
      const viewedFiles = existing?.viewedFiles ?? []
      if (viewedFiles.includes(filePath)) return

      data = {
        ...data,
        [prUrl]: {
          viewedFiles: [...viewedFiles, filePath],
          lastUpdated: new Date().toISOString(),
        },
      }
      notify()
    },

    markUnviewed(prUrl: string, filePath: string) {
      const existing = data[prUrl]
      if (!existing) return

      const viewedFiles = existing.viewedFiles.filter((f) => f !== filePath)
      data = {
        ...data,
        [prUrl]: {
          viewedFiles,
          lastUpdated: new Date().toISOString(),
        },
      }
      notify()
    },

    toggleViewed(prUrl: string, filePath: string) {
      const existing = data[prUrl]
      const viewedFiles = existing?.viewedFiles ?? []
      if (viewedFiles.includes(filePath)) {
        this.markUnviewed(prUrl, filePath)
      } else {
        this.markViewed(prUrl, filePath)
      }
    },

    isViewed(prUrl: string, filePath: string): boolean {
      const entry = data[prUrl]
      if (!entry) return false
      return entry.viewedFiles.includes(filePath)
    },

    getViewedCount(prUrl: string): number {
      const entry = data[prUrl]
      if (!entry) return 0
      return entry.viewedFiles.length
    },
  }
}

// ---------------------------------------------------------------------------
// Singleton management
// ---------------------------------------------------------------------------

let singletonStore: ViewedFilesStore | null = null
let singletonStateStore: StateStore | null = null

function getOrCreateStore(stateStore: StateStore | null): ViewedFilesStore {
  if (stateStore && stateStore !== singletonStateStore) {
    singletonStateStore = stateStore
    singletonStore = createSqliteViewedFilesStore(stateStore)
    return singletonStore
  }
  if (singletonStore) return singletonStore
  singletonStore = createViewedFilesStore()
  return singletonStore
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useViewedFiles(): {
  readonly viewedFilesData: ViewedFilesData
  readonly markViewed: (prUrl: string, filePath: string) => void
  readonly markUnviewed: (prUrl: string, filePath: string) => void
  readonly toggleViewed: (prUrl: string, filePath: string) => void
  readonly isViewed: (prUrl: string, filePath: string) => boolean
  readonly getViewedCount: (prUrl: string) => number
} {
  const stateStore = useStateStore()
  const store = getOrCreateStore(stateStore)

  const viewedFilesData = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => ({}) as ViewedFilesData,
  )

  const markViewed = useCallback(
    (prUrl: string, filePath: string) => {
      store.markViewed(prUrl, filePath)
    },
    [store],
  )

  const markUnviewed = useCallback(
    (prUrl: string, filePath: string) => {
      store.markUnviewed(prUrl, filePath)
    },
    [store],
  )

  const toggleViewed = useCallback(
    (prUrl: string, filePath: string) => {
      store.toggleViewed(prUrl, filePath)
    },
    [store],
  )

  const isViewed = useCallback(
    (prUrl: string, filePath: string) => {
      return store.isViewed(prUrl, filePath)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewedFilesData, store],
  )

  const getViewedCount = useCallback(
    (prUrl: string) => {
      return store.getViewedCount(prUrl)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewedFilesData, store],
  )

  return {
    viewedFilesData,
    markViewed,
    markUnviewed,
    toggleViewed,
    isViewed,
    getViewedCount,
  } as const
}
