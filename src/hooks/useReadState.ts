import { useCallback, useSyncExternalStore } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { createDebouncedWriter } from '../utils/debouncedWriter'

const CONFIG_DIR = join(homedir(), '.config', 'lazyreview')
const READ_STATE_FILE = join(CONFIG_DIR, 'read-state.json')

const PRUNE_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export interface ReadEntry {
  readonly lastSeenAt: string
  readonly prUpdatedAt: string
}

export type ReadStateData = Readonly<Record<string, ReadEntry>>

type Listener = () => void

interface ReadStateStore {
  readonly subscribe: (listener: Listener) => () => void
  readonly getSnapshot: () => ReadStateData
  readonly markAsRead: (htmlUrl: string, prUpdatedAt: string) => void
  readonly isUnread: (htmlUrl: string, prUpdatedAt: string) => boolean
}

function isReadEntry(value: unknown): value is ReadEntry {
  if (value == null || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return typeof obj['lastSeenAt'] === 'string' && typeof obj['prUpdatedAt'] === 'string'
}

function loadFromDisk(): ReadStateData {
  try {
    const raw = readFileSync(READ_STATE_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const result: Record<string, ReadEntry> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (isReadEntry(value)) {
        result[key] = value
      }
    }
    return result
  } catch {
    return {}
  }
}

function pruneOldEntries(data: ReadStateData): ReadStateData {
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

function createReadStateStore(): ReadStateStore {
  const writer = createDebouncedWriter<ReadStateData>(READ_STATE_FILE)
  let data: ReadStateData = pruneOldEntries(loadFromDisk())
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

    markAsRead(htmlUrl: string, prUpdatedAt: string) {
      const now = new Date().toISOString()
      data = {
        ...data,
        [htmlUrl]: { lastSeenAt: now, prUpdatedAt },
      }
      writer.schedule(data)
      notify()
    },

    isUnread(htmlUrl: string, prUpdatedAt: string): boolean {
      const entry = data[htmlUrl]
      if (!entry) return true // Never seen
      // Unread if PR was updated after we last saw it
      return new Date(prUpdatedAt).getTime() > new Date(entry.prUpdatedAt).getTime()
    },
  }
}

const store = createReadStateStore()

export function useReadState(): {
  readonly readState: ReadStateData
  readonly markAsRead: (htmlUrl: string, prUpdatedAt: string) => void
  readonly isUnread: (htmlUrl: string, prUpdatedAt: string) => boolean
} {
  const readState = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => ({} as ReadStateData),
  )

  const markAsRead = useCallback(
    (htmlUrl: string, prUpdatedAt: string) => {
      store.markAsRead(htmlUrl, prUpdatedAt)
    },
    [],
  )

  const isUnread = useCallback(
    (htmlUrl: string, prUpdatedAt: string) => {
      return store.isUnread(htmlUrl, prUpdatedAt)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [readState], // Re-evaluate when readState changes
  )

  return { readState, markAsRead, isUnread } as const
}

// Export for testing
export { pruneOldEntries, createReadStateStore }
export type { ReadStateStore }
