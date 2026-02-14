import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  bookmarkStore,
  resetBookmarkStore,
  type BookmarkStoreState,
} from './useDiffBookmarks'

beforeEach(() => {
  resetBookmarkStore()
})

describe('bookmarkStore initial state', () => {
  it('starts with empty bookmarks', () => {
    const state = bookmarkStore.getSnapshot()
    expect(state.bookmarks).toEqual([])
  })

  it('starts not capturing a register', () => {
    const state = bookmarkStore.getSnapshot()
    expect(state.isCapturingRegister).toBe(false)
    expect(state.captureMode).toBeNull()
  })
})

describe('bookmarkStore.setBookmark', () => {
  it('sets a bookmark', () => {
    bookmarkStore.setBookmark('a', 'src/index.ts', 42, 'pr1')
    const state = bookmarkStore.getSnapshot()
    expect(state.bookmarks).toHaveLength(1)
    expect(state.bookmarks[0]?.register).toBe('a')
    expect(state.bookmarks[0]?.file).toBe('src/index.ts')
    expect(state.bookmarks[0]?.line).toBe(42)
  })

  it('notifies subscribers when setting', () => {
    const listener = vi.fn()
    const unsub = bookmarkStore.subscribe(listener)
    bookmarkStore.setBookmark('a', 'file.ts', 10, 'pr1')
    expect(listener).toHaveBeenCalledTimes(1)
    unsub()
  })

  it('overrides existing bookmark in same register', () => {
    bookmarkStore.setBookmark('a', 'file1.ts', 10, 'pr1')
    bookmarkStore.setBookmark('a', 'file2.ts', 99, 'pr1')
    const state = bookmarkStore.getSnapshot()
    expect(state.bookmarks).toHaveLength(1)
    expect(state.bookmarks[0]?.file).toBe('file2.ts')
    expect(state.bookmarks[0]?.line).toBe(99)
  })

  it('does not set for invalid register', () => {
    const listener = vi.fn()
    const unsub = bookmarkStore.subscribe(listener)
    bookmarkStore.setBookmark('1', 'file.ts', 10, 'pr1')
    expect(listener).not.toHaveBeenCalled()
    const state = bookmarkStore.getSnapshot()
    expect(state.bookmarks).toHaveLength(0)
    unsub()
  })
})

describe('bookmarkStore.getBookmark', () => {
  it('returns a bookmark by register', () => {
    bookmarkStore.setBookmark('m', 'utils.ts', 55, 'pr2')
    const bookmark = bookmarkStore.getBookmark('m')
    expect(bookmark).not.toBeNull()
    expect(bookmark?.file).toBe('utils.ts')
  })

  it('returns null for non-existent register', () => {
    expect(bookmarkStore.getBookmark('z')).toBeNull()
  })
})

describe('bookmarkStore.removeBookmark', () => {
  it('removes an existing bookmark', () => {
    bookmarkStore.setBookmark('a', 'file.ts', 10, 'pr1')
    bookmarkStore.removeBookmark('a')
    const state = bookmarkStore.getSnapshot()
    expect(state.bookmarks).toHaveLength(0)
  })

  it('notifies subscribers when removing', () => {
    bookmarkStore.setBookmark('a', 'file.ts', 10, 'pr1')
    const listener = vi.fn()
    const unsub = bookmarkStore.subscribe(listener)
    bookmarkStore.removeBookmark('a')
    expect(listener).toHaveBeenCalledTimes(1)
    unsub()
  })

  it('does not notify if register does not exist', () => {
    const listener = vi.fn()
    const unsub = bookmarkStore.subscribe(listener)
    bookmarkStore.removeBookmark('z')
    expect(listener).not.toHaveBeenCalled()
    unsub()
  })

  it('does not affect other bookmarks', () => {
    bookmarkStore.setBookmark('a', 'file1.ts', 10, 'pr1')
    bookmarkStore.setBookmark('b', 'file2.ts', 20, 'pr1')
    bookmarkStore.removeBookmark('a')
    const state = bookmarkStore.getSnapshot()
    expect(state.bookmarks).toHaveLength(1)
    expect(state.bookmarks[0]?.register).toBe('b')
  })
})

describe('bookmarkStore.startRegisterCapture', () => {
  it('sets capturing state with set mode', () => {
    bookmarkStore.startRegisterCapture('set')
    const state = bookmarkStore.getSnapshot()
    expect(state.isCapturingRegister).toBe(true)
    expect(state.captureMode).toBe('set')
  })

  it('sets capturing state with jump mode', () => {
    bookmarkStore.startRegisterCapture('jump')
    const state = bookmarkStore.getSnapshot()
    expect(state.isCapturingRegister).toBe(true)
    expect(state.captureMode).toBe('jump')
  })

  it('notifies subscribers', () => {
    const listener = vi.fn()
    const unsub = bookmarkStore.subscribe(listener)
    bookmarkStore.startRegisterCapture('set')
    expect(listener).toHaveBeenCalledTimes(1)
    unsub()
  })
})

describe('bookmarkStore.cancelRegisterCapture', () => {
  it('clears capturing state', () => {
    bookmarkStore.startRegisterCapture('set')
    bookmarkStore.cancelRegisterCapture()
    const state = bookmarkStore.getSnapshot()
    expect(state.isCapturingRegister).toBe(false)
    expect(state.captureMode).toBeNull()
  })

  it('notifies subscribers', () => {
    bookmarkStore.startRegisterCapture('set')
    const listener = vi.fn()
    const unsub = bookmarkStore.subscribe(listener)
    bookmarkStore.cancelRegisterCapture()
    expect(listener).toHaveBeenCalledTimes(1)
    unsub()
  })

  it('does not notify if not capturing', () => {
    const listener = vi.fn()
    const unsub = bookmarkStore.subscribe(listener)
    bookmarkStore.cancelRegisterCapture()
    expect(listener).not.toHaveBeenCalled()
    unsub()
  })
})

describe('bookmarkStore.subscribe', () => {
  it('unsubscribes correctly', () => {
    const listener = vi.fn()
    const unsub = bookmarkStore.subscribe(listener)
    unsub()
    bookmarkStore.setBookmark('a', 'file.ts', 10, 'pr1')
    expect(listener).not.toHaveBeenCalled()
  })

  it('supports multiple subscribers', () => {
    const listener1 = vi.fn()
    const listener2 = vi.fn()
    const unsub1 = bookmarkStore.subscribe(listener1)
    const unsub2 = bookmarkStore.subscribe(listener2)
    bookmarkStore.setBookmark('a', 'file.ts', 10, 'pr1')
    expect(listener1).toHaveBeenCalledTimes(1)
    expect(listener2).toHaveBeenCalledTimes(1)
    unsub1()
    unsub2()
  })
})

describe('resetBookmarkStore', () => {
  it('resets all state', () => {
    bookmarkStore.setBookmark('a', 'file.ts', 10, 'pr1')
    bookmarkStore.startRegisterCapture('set')
    resetBookmarkStore()

    const state = bookmarkStore.getSnapshot()
    expect(state.bookmarks).toEqual([])
    expect(state.isCapturingRegister).toBe(false)
    expect(state.captureMode).toBeNull()
  })
})

describe('bookmarkStore sorted output', () => {
  it('returns bookmarks sorted by register in snapshot', () => {
    bookmarkStore.setBookmark('c', 'file3.ts', 30, 'pr1')
    bookmarkStore.setBookmark('a', 'file1.ts', 10, 'pr1')
    bookmarkStore.setBookmark('b', 'file2.ts', 20, 'pr1')

    const state = bookmarkStore.getSnapshot()
    expect(state.bookmarks[0]?.register).toBe('a')
    expect(state.bookmarks[1]?.register).toBe('b')
    expect(state.bookmarks[2]?.register).toBe('c')
  })
})
