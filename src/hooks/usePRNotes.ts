import { useCallback, useSyncExternalStore } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void

export type PRNotesData = Readonly<Record<string, string>>

export interface PRNotesStore {
  readonly subscribe: (listener: Listener) => () => void
  readonly getSnapshot: () => PRNotesData
  readonly getNote: (key: string) => string | null
  readonly saveNote: (key: string, content: string) => void
  readonly deleteNote: (key: string) => void
  readonly hasNote: (key: string) => boolean
}

// ---------------------------------------------------------------------------
// In-memory store (will swap to StateStore later)
// ---------------------------------------------------------------------------

export function createPRNotesStore(): PRNotesStore {
  let data: PRNotesData = {}
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

    getNote(key: string): string | null {
      const value = data[key]
      return value !== undefined ? value : null
    },

    saveNote(key: string, content: string) {
      data = { ...data, [key]: content }
      notify()
    },

    deleteNote(key: string) {
      if (data[key] === undefined) return
      const { [key]: _, ...rest } = data
      data = rest
      notify()
    },

    hasNote(key: string): boolean {
      return data[key] !== undefined
    },
  }
}

// ---------------------------------------------------------------------------
// Singleton store instance
// ---------------------------------------------------------------------------

const store = createPRNotesStore()

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function usePRNotes(key: string): {
  readonly note: string | null
  readonly saveNote: (content: string) => void
  readonly deleteNote: () => void
  readonly hasNote: boolean
} {
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => ({} as PRNotesData),
  )

  const note = snapshot[key] !== undefined ? snapshot[key] : null

  const saveNote = useCallback(
    (content: string) => {
      store.saveNote(key, content)
    },
    [key],
  )

  const deleteNote = useCallback(() => {
    store.deleteNote(key)
  }, [key])

  const hasNote = snapshot[key] !== undefined

  return { note, saveNote, deleteNote, hasNote } as const
}

// Export the singleton for use in components that need to check notes
// without the full hook (e.g. PRListItem)
export { store as prNotesStore }
