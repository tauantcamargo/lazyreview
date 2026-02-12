import { useCallback, useSyncExternalStore } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { createDebouncedWriter } from '../utils/debouncedWriter'

const CONFIG_DIR = join(homedir(), '.config', 'lazyreview')
const VIEWED_FILES_PATH = join(CONFIG_DIR, 'viewed-files.json')

const PRUNE_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

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

function loadFromDisk(): ViewedFilesData {
  try {
    const raw = readFileSync(VIEWED_FILES_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as Record<string, ViewedEntry>
    return parsed
  } catch {
    return {}
  }
}

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

export function createViewedFilesStore(): ViewedFilesStore {
  const writer = createDebouncedWriter<ViewedFilesData>(VIEWED_FILES_PATH)
  let data: ViewedFilesData = pruneOldEntries(loadFromDisk())
  let listeners: readonly Listener[] = []

  // Save pruned data if entries were removed
  writer.schedule(data)

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
      if (viewedFiles.includes(filePath)) return // Already viewed

      data = {
        ...data,
        [prUrl]: {
          viewedFiles: [...viewedFiles, filePath],
          lastUpdated: new Date().toISOString(),
        },
      }
      writer.schedule(data)
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
      writer.schedule(data)
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

const store = createViewedFilesStore()

export function useViewedFiles(): {
  readonly viewedFilesData: ViewedFilesData
  readonly markViewed: (prUrl: string, filePath: string) => void
  readonly markUnviewed: (prUrl: string, filePath: string) => void
  readonly toggleViewed: (prUrl: string, filePath: string) => void
  readonly isViewed: (prUrl: string, filePath: string) => boolean
  readonly getViewedCount: (prUrl: string) => number
} {
  const viewedFilesData = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => ({} as ViewedFilesData),
  )

  const markViewed = useCallback(
    (prUrl: string, filePath: string) => {
      store.markViewed(prUrl, filePath)
    },
    [],
  )

  const markUnviewed = useCallback(
    (prUrl: string, filePath: string) => {
      store.markUnviewed(prUrl, filePath)
    },
    [],
  )

  const toggleViewed = useCallback(
    (prUrl: string, filePath: string) => {
      store.toggleViewed(prUrl, filePath)
    },
    [],
  )

  const isViewed = useCallback(
    (prUrl: string, filePath: string) => {
      return store.isViewed(prUrl, filePath)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewedFilesData], // Re-evaluate when data changes
  )

  const getViewedCount = useCallback(
    (prUrl: string) => {
      return store.getViewedCount(prUrl)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewedFilesData], // Re-evaluate when data changes
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
