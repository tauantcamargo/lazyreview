import { useCallback, useSyncExternalStore } from 'react'

export type FileReviewStatus = 'pending' | 'approved' | 'needs-changes' | 'skipped'

export interface FileReviewSummary {
  readonly total: number
  readonly approved: number
  readonly needsChanges: number
  readonly skipped: number
  readonly pending: number
}

/**
 * Outer map: prKey -> inner map (filePath -> status).
 * Both maps are recreated on mutation (immutable).
 */
type StoreData = ReadonlyMap<string, ReadonlyMap<string, FileReviewStatus>>

type Listener = () => void

export interface FileReviewStatusStore {
  readonly subscribe: (listener: Listener) => () => void
  readonly getSnapshot: () => StoreData
  readonly setStatus: (prKey: string, filePath: string, status: FileReviewStatus) => void
  readonly clearStatus: (prKey: string, filePath: string) => void
  readonly clearAll: (prKey: string) => void
  readonly getStatusForPR: (prKey: string) => ReadonlyMap<string, FileReviewStatus>
}

export function createFileReviewStatusStore(): FileReviewStatusStore {
  let data: StoreData = new Map()
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

    setStatus(prKey: string, filePath: string, status: FileReviewStatus) {
      const existing = data.get(prKey) ?? new Map<string, FileReviewStatus>()
      const updated = new Map(existing)
      updated.set(filePath, status)
      const next = new Map(data)
      next.set(prKey, updated)
      data = next
      notify()
    },

    clearStatus(prKey: string, filePath: string) {
      const existing = data.get(prKey)
      if (!existing) return
      const updated = new Map(existing)
      updated.delete(filePath)
      const next = new Map(data)
      next.set(prKey, updated)
      data = next
      notify()
    },

    clearAll(prKey: string) {
      const existing = data.get(prKey)
      if (!existing) return
      const next = new Map(data)
      next.set(prKey, new Map())
      data = next
      notify()
    },

    getStatusForPR(prKey: string): ReadonlyMap<string, FileReviewStatus> {
      return data.get(prKey) ?? new Map<string, FileReviewStatus>()
    },
  }
}

/**
 * Compute a summary of review statuses for display.
 */
export function computeSummary(
  statuses: ReadonlyMap<string, FileReviewStatus>,
  totalFiles: number,
): FileReviewSummary {
  let approved = 0
  let needsChanges = 0
  let skipped = 0

  for (const status of statuses.values()) {
    if (status === 'approved') approved++
    else if (status === 'needs-changes') needsChanges++
    else if (status === 'skipped') skipped++
  }

  const reviewed = approved + needsChanges + skipped
  const pending = Math.max(0, totalFiles - reviewed)

  return { total: totalFiles, approved, needsChanges, skipped, pending }
}

/**
 * Find the next unreviewed file after the current file.
 * Wraps around to the beginning if needed.
 * Returns null if all files are reviewed or the list is empty.
 */
export function findNextUnreviewed(
  currentFile: string,
  files: readonly string[],
  statuses: ReadonlyMap<string, FileReviewStatus>,
): string | null {
  if (files.length === 0) return null

  const currentIndex = files.indexOf(currentFile)
  const startIndex = currentIndex >= 0 ? currentIndex : -1

  for (let offset = 1; offset < files.length; offset++) {
    const idx = (startIndex + offset + files.length) % files.length
    const file = files[idx]
    if (file != null && !statuses.has(file)) {
      return file
    }
  }

  return null
}

/**
 * Find the previous unreviewed file before the current file.
 * Wraps around to the end if needed.
 * Returns null if all files are reviewed or the list is empty.
 */
export function findPrevUnreviewed(
  currentFile: string,
  files: readonly string[],
  statuses: ReadonlyMap<string, FileReviewStatus>,
): string | null {
  if (files.length === 0) return null

  const currentIndex = files.indexOf(currentFile)
  const startIndex = currentIndex >= 0 ? currentIndex : 0

  for (let offset = 1; offset < files.length; offset++) {
    const idx = (startIndex - offset + files.length) % files.length
    const file = files[idx]
    if (file != null && !statuses.has(file)) {
      return file
    }
  }

  return null
}

// Module-level singleton store
const store = createFileReviewStatusStore()

export function useFileReviewStatus(prKey: string): {
  readonly statuses: ReadonlyMap<string, FileReviewStatus>
  readonly setStatus: (filePath: string, status: FileReviewStatus) => void
  readonly clearStatus: (filePath: string) => void
  readonly clearAll: () => void
  readonly getSummary: (totalFiles: number) => FileReviewSummary
  readonly nextUnreviewed: (currentFile: string, files: readonly string[]) => string | null
  readonly prevUnreviewed: (currentFile: string, files: readonly string[]) => string | null
} {
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => new Map() as StoreData,
  )

  const statuses = snapshot.get(prKey) ?? new Map<string, FileReviewStatus>()

  const setStatus = useCallback(
    (filePath: string, status: FileReviewStatus) => {
      store.setStatus(prKey, filePath, status)
    },
    [prKey],
  )

  const clearStatus = useCallback(
    (filePath: string) => {
      store.clearStatus(prKey, filePath)
    },
    [prKey],
  )

  const clearAll = useCallback(() => {
    store.clearAll(prKey)
  }, [prKey])

  const getSummary = useCallback(
    (totalFiles: number) => computeSummary(statuses, totalFiles),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [statuses],
  )

  const nextUnreviewed = useCallback(
    (currentFile: string, files: readonly string[]) =>
      findNextUnreviewed(currentFile, files, statuses),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [statuses],
  )

  const prevUnreviewed = useCallback(
    (currentFile: string, files: readonly string[]) =>
      findPrevUnreviewed(currentFile, files, statuses),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [statuses],
  )

  return {
    statuses,
    setStatus,
    clearStatus,
    clearAll,
    getSummary,
    nextUnreviewed,
    prevUnreviewed,
  } as const
}
