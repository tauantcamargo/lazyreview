/**
 * Diff bookmark hook + store for LazyReview.
 *
 * Uses a module-level external store (same pattern as useMacros, useStatusMessage)
 * so that bookmark state is shared across all components and can be tested
 * without rendering React components.
 *
 * The React hook `useDiffBookmarks` provides a thin wrapper via useSyncExternalStore.
 *
 * Supports two-phase input:
 *   1. Press `m` to start "set" capture, then press `a-z` for register
 *   2. Press `'` to start "jump" capture, then press `a-z` for register
 */

import { useSyncExternalStore, useCallback } from 'react'
import {
  createBookmarkState,
  setBookmark as setBm,
  getBookmark as getBm,
  removeBookmark as removeBm,
  listBookmarks as listBm,
  isValidRegister,
  type BookmarkState,
  type DiffBookmark,
} from '../utils/diff-bookmarks'

export type { DiffBookmark }

type Listener = () => void
type CaptureMode = 'set' | 'jump'

export interface BookmarkStoreState {
  readonly bookmarks: readonly DiffBookmark[]
  readonly isCapturingRegister: boolean
  readonly captureMode: CaptureMode | null
}

interface BookmarkStore {
  readonly subscribe: (listener: Listener) => () => void
  readonly getSnapshot: () => BookmarkStoreState
  readonly setBookmark: (register: string, file: string, line: number, prKey: string) => void
  readonly getBookmark: (register: string) => DiffBookmark | null
  readonly removeBookmark: (register: string) => void
  readonly startRegisterCapture: (mode: CaptureMode) => void
  readonly cancelRegisterCapture: () => void
  readonly reset: () => void
}

function buildSnapshot(
  state: BookmarkState,
  capturing: boolean,
  mode: CaptureMode | null,
): BookmarkStoreState {
  return {
    bookmarks: listBm(state),
    isCapturingRegister: capturing,
    captureMode: mode,
  }
}

function createBookmarkStore(): BookmarkStore {
  let state = createBookmarkState()
  let capturing = false
  let captureMode: CaptureMode | null = null
  let snapshot = buildSnapshot(state, capturing, captureMode)
  let listeners: readonly Listener[] = []

  const notify = (): void => {
    snapshot = buildSnapshot(state, capturing, captureMode)
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

    setBookmark(register: string, file: string, line: number, prKey: string) {
      if (!isValidRegister(register)) return
      const next = setBm(state, register, file, line, prKey)
      if (next === state) return
      state = next
      notify()
    },

    getBookmark(register: string): DiffBookmark | null {
      return getBm(state, register)
    },

    removeBookmark(register: string) {
      const next = removeBm(state, register)
      if (next === state) return
      state = next
      notify()
    },

    startRegisterCapture(mode: CaptureMode) {
      capturing = true
      captureMode = mode
      notify()
    },

    cancelRegisterCapture() {
      if (!capturing) return
      capturing = false
      captureMode = null
      notify()
    },

    reset() {
      state = createBookmarkState()
      capturing = false
      captureMode = null
      notify()
    },
  }
}

export const bookmarkStore = createBookmarkStore()

/** Reset the store to initial state (for testing). */
export function resetBookmarkStore(): void {
  bookmarkStore.reset()
}

/**
 * React hook for diff bookmarks.
 *
 * Provides bookmark CRUD operations and two-phase register capture state
 * for vim-style mark setting and jumping.
 */
export function useDiffBookmarks(): {
  readonly bookmarks: readonly DiffBookmark[]
  readonly isCapturingRegister: boolean
  readonly captureMode: CaptureMode | null
  readonly setBookmark: (register: string, file: string, line: number, prKey: string) => void
  readonly getBookmark: (register: string) => DiffBookmark | null
  readonly removeBookmark: (register: string) => void
  readonly startRegisterCapture: (mode: CaptureMode) => void
  readonly cancelRegisterCapture: () => void
} {
  const state = useSyncExternalStore(
    bookmarkStore.subscribe,
    bookmarkStore.getSnapshot,
    () => bookmarkStore.getSnapshot(),
  )

  const setBookmark = useCallback(
    (register: string, file: string, line: number, prKey: string) => {
      bookmarkStore.setBookmark(register, file, line, prKey)
    },
    [],
  )

  const getBookmark = useCallback((register: string) => {
    return bookmarkStore.getBookmark(register)
  }, [])

  const removeBookmark = useCallback((register: string) => {
    bookmarkStore.removeBookmark(register)
  }, [])

  const startRegisterCapture = useCallback((mode: CaptureMode) => {
    bookmarkStore.startRegisterCapture(mode)
  }, [])

  const cancelRegisterCapture = useCallback(() => {
    bookmarkStore.cancelRegisterCapture()
  }, [])

  return {
    bookmarks: state.bookmarks,
    isCapturingRegister: state.isCapturingRegister,
    captureMode: state.captureMode,
    setBookmark,
    getBookmark,
    removeBookmark,
    startRegisterCapture,
    cancelRegisterCapture,
  }
}
